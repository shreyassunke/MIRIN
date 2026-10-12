import { useEffect, useMemo, useRef, useState } from "react";
import type { FiberRecruitment } from "./recruitment";
import {
  CANVAS_STRAND_LIMIT,
  generateStrands,
  parseOutline,
  strandOn,
  strandPath,
  STRAND_COUNT,
  type Strand,
} from "./strands";
import type { FiberType } from "./types";

const TONE: Record<FiberType, string> = {
  I: "var(--fiber-i)",
  IIa: "var(--fiber-iia)",
  IIx: "var(--fiber-iix)",
};

interface FiberStrandsProps {
  muscleId: string;
  outline: string;
  viewBox: readonly [number, number, number, number];
  /** Head outlines in the same frame as `outline`. */
  heads: readonly { id: string; outline: string }[];
  /** Each head's share of this variant. 1 is the most activated region. */
  shade: Readonly<Record<string, number>>;
  ratio: Record<FiberType, number>;
  /** Composition of each head. Falls back to `ratio` for a head that has none. */
  headRatios?: Readonly<Record<string, Record<FiberType, number>>>;
  /** Recruitment to show. The field eases here from `stage` when that is set. */
  recruitment: FiberRecruitment;
  /** Opening-rep recruitment of the logging draft, before this target. */
  stage?: FiberRecruitment;
  count?: number;
  label: string;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function useFiberAlphas() {
  const [alphas, setAlphas] = useState({ on: 0.72, dim: 0.3 });
  useEffect(() => {
    const styles = getComputedStyle(document.documentElement);
    const on = Number(styles.getPropertyValue("--fiber-on-alpha"));
    const dim = Number(styles.getPropertyValue("--fiber-late-alpha"));
    setAlphas({
      on: Number.isFinite(on) && on > 0 ? on : 0.72,
      dim: Number.isFinite(dim) && dim > 0 ? dim : 0.3,
    });
  }, []);
  return alphas;
}

function paint(
  strand: Strand,
  shown: FiberRecruitment,
  alphas: { on: number; dim: number },
  shade: Readonly<Record<string, number>>,
) {
  const share = strand.head != null ? Math.min(1, Math.max(0, shade[strand.head] ?? 0)) : 0;
  const on = strandOn(strand, shown);
  const emphasis = share * share;
  const opacity = 0.12 + emphasis * (on ? alphas.on + 0.18 : alphas.on);
  return {
    opacity,
    width: 0.7 + emphasis * (on ? 1.05 : 0.45),
    stroke: share >= 0.75 ? TONE[strand.type] : TONE.I,
  };
}

/**
 * One muscle as a fan of fascicles, origin border to tendon. A head's
 * brightness is its share of this variant, most activated to least.
 * Above 600 strands the same field is drawn on canvas.
 */
export function FiberStrands({
  muscleId,
  outline,
  viewBox,
  heads,
  shade,
  ratio,
  headRatios,
  recruitment,
  stage,
  count = STRAND_COUNT,
  label,
}: FiberStrandsProps) {
  const reduced = useReducedMotion();
  const alphas = useFiberAlphas();
  const targetI = recruitment.I;
  const targetIIa = recruitment.IIa;
  const targetIIx = recruitment.IIx;
  const [shown, setShown] = useState<FiberRecruitment>(
    () => (reduced ? recruitment : (stage ?? recruitment)),
  );

  useEffect(() => {
    const next = { I: targetI, IIa: targetIIa, IIx: targetIIx };
    if (reduced) {
      setShown(next);
      return;
    }
    const frame = requestAnimationFrame(() => setShown(next));
    return () => cancelAnimationFrame(frame);
  }, [targetI, targetIIa, targetIIx, reduced]);

  const strands = useMemo(
    () =>
      generateStrands({
        muscleId,
        ring: parseOutline(outline),
        heads: heads.map((head) => ({ id: head.id, ring: parseOutline(head.outline) })),
        ratio,
        headRatios,
        count,
      }),
    [muscleId, outline, heads, ratio, headRatios, count],
  );

  const box = viewBox.join(" ");
  // The drawing keeps its own proportion and stops at 13rem, so the
  // prescription above it stays the thing you read.
  const natural = viewBox[2] / Math.max(viewBox[3], 1);
  const aspect = Number.isFinite(natural) && natural > 0 ? natural : 1;

  return (
    <div
      className="fiber-field fiber-strands"
      style={{
        aspectRatio: String(aspect),
        width: `min(100%, calc(13rem * ${aspect}))`,
      }}
    >
      {strands.length > CANVAS_STRAND_LIMIT ? (
        <StrandCanvas
          strands={strands}
          outline={outline}
          viewBox={viewBox}
          shown={shown}
          alphas={alphas}
          shade={shade}
          label={label}
        />
      ) : (
        <svg className="strand-plate" viewBox={box} role="img" aria-label={label}>
          <path className="plate-belly" d={outline} />
          <path className="plate-edge" d={outline} />
          {[...strands]
            .sort((a, b) => (shade[a.head ?? ""] ?? 0) - (shade[b.head ?? ""] ?? 0))
            .map((strand) => {
              const ink = paint(strand, shown, alphas, shade);
              return (
                <path
                  key={`${strand.head ?? "muscle"}-${strand.type}-${strand.rank}`}
                  className="fiber-strand"
                  d={strandPath(strand)}
                  style={{
                    stroke: ink.stroke,
                    opacity: ink.opacity,
                    strokeWidth: ink.width,
                  }}
                />
              );
            })}
        </svg>
      )}
    </div>
  );
}

function StrandCanvas({
  strands,
  outline,
  viewBox,
  shown,
  alphas,
  shade,
  label,
}: {
  strands: Strand[];
  outline: string;
  viewBox: readonly [number, number, number, number];
  shown: FiberRecruitment;
  alphas: { on: number; dim: number };
  shade: Readonly<Record<string, number>>;
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const shownRef = useRef(shown);
  const drawn = useRef<number[] | null>(null);
  shownRef.current = shown;

  useEffect(() => {
    const canvas = ref.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const styles = getComputedStyle(document.documentElement);
    const tone = (type: FiberType) => {
      const name = type === "I" ? "--fiber-i" : type === "IIa" ? "--fiber-iia" : "--fiber-iix";
      return styles.getPropertyValue(name).trim() || "#7d93a1";
    };
    const belly = styles.getPropertyValue("--plate-belly").trim() || "rgba(250,250,250,0.13)";
    const edge = styles.getPropertyValue("--plate-edge").trim() || "rgba(250,250,250,0.26)";
      const previous = drawn.current;
      const from =
        previous && previous.length === strands.length
          ? previous
          : strands.map((strand) => paint(strand, shownRef.current, alphas, shade).opacity);
    const start = performance.now();
    let frame = 0;

    const draw = (now: number) => {
      const t = reduced ? 1 : Math.min(1, (now - start) / 420);
      const ease = t >= 1 ? 1 : 1 - 2 ** (-10 * t);
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, parent.clientWidth);
      const height = Math.max(1, parent.clientHeight);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      const [minX, minY, vbW, vbH] = viewBox;
      const scale = Math.min(width / vbW, height / vbH);
      const offsetX = (width - vbW * scale) / 2 - minX * scale;
      const offsetY = (height - vbH * scale) / 2 - minY * scale;
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offsetX, dpr * offsetY);
      ctx.clearRect(minX - 20, minY - 20, vbW + 40, vbH + 40);
      const shape = new Path2D(outline);
      ctx.fillStyle = belly;
      ctx.fill(shape);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1 / scale;
      ctx.stroke(shape);
      const current = shownRef.current;
      strands.forEach((strand, index) => {
        const target = paint(strand, current, alphas, shade);
        ctx.beginPath();
        strand.points.forEach((point, pointIndex) => {
          if (pointIndex === 0) ctx.moveTo(point[0], point[1]);
          else ctx.lineTo(point[0], point[1]);
        });
        const colorType: FiberType =
          target.stroke === TONE.IIa ? "IIa" : target.stroke === TONE.IIx ? "IIx" : "I";
        ctx.strokeStyle = tone(colorType);
        ctx.globalAlpha = from[index] + (target.opacity - from[index]) * ease;
        ctx.lineWidth = target.width / scale;
        ctx.lineCap = "round";
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
      if (t < 1) frame = requestAnimationFrame(draw);
      else {
        drawn.current = strands.map((strand) =>
          paint(strand, shownRef.current, alphas, shade).opacity,
        );
      }
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [alphas, outline, shade, shown.I, shown.IIa, shown.IIx, strands, viewBox]);

  return <canvas ref={ref} role="img" aria-label={label} />;
}
