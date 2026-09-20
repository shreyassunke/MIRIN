import { useLayoutEffect, useRef, useState } from "react";
import { PLATE_SIZES, plateColor, plateInk, type Unit } from "../../lib/units";
import { formatWeight } from "../../lib/workout";
import { hasWebGL } from "./three/fallback";

interface PlateRackProps {
  unit: Unit;
  counts: Map<number, number>;
  onAdd: (value: number) => void;
}

function plateChipPx(value: number, max: number) {
  return Math.round(38 + 22 * Math.sqrt(value / max));
}

function drawFallbackPlate(
  ctx: CanvasRenderingContext2D,
  value: number,
  unit: Unit,
  size: number,
) {
  const hex = plateColor(unit, value);
  const cx = size * 0.5;
  const cy = size * 0.5;
  const r = size * 0.46;
  const hole = Math.max(3, r * 0.14);
  ctx.clearRect(0, 0, size, size);

  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.1, r * 0.9, r * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = hex;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = Math.max(1.25, r * 0.045);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.965, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(cx, cy, hole, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  ctx.strokeStyle = "#98989f";
  ctx.lineWidth = Math.max(1, r * 0.04);
  ctx.beginPath();
  ctx.arc(cx, cy, hole + ctx.lineWidth * 0.5, 0, Math.PI * 2);
  ctx.stroke();

  const label = formatWeight(value);
  ctx.fillStyle = plateInk(hex);
  ctx.font = `700 ${Math.round(size * (label.length >= 4 ? 0.16 : 0.2))}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, cx, cy - r * 0.5);
  ctx.fillText(label, cx, cy + r * 0.5);
}

function PlateThumb({
  value,
  unit,
  size,
  sprite,
}: {
  value: number;
  unit: Unit;
  size: number;
  sprite: HTMLCanvasElement | null;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dpr = Math.min(2, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
  const px = Math.max(48, Math.round(size * dpr));

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.width = sprite?.width ?? px;
    el.height = sprite?.height ?? px;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, el.width, el.height);
    if (sprite) ctx.drawImage(sprite, 0, 0);
    else drawFallbackPlate(ctx, value, unit, el.width);
  }, [sprite, value, unit, px]);

  return (
    <canvas
      ref={ref}
      className="pointer-events-none"
      style={{
        width: size,
        height: size,
        filter: "drop-shadow(0 2px 3px rgb(0 0 0 / 0.5))",
      }}
      aria-hidden="true"
    />
  );
}

export function PlateRack({ unit, counts, onAdd }: PlateRackProps) {
  const sizes = PLATE_SIZES[unit];
  const max = sizes[0];
  const [sprites, setSprites] = useState<Record<number, HTMLCanvasElement>>({});

  useLayoutEffect(() => {
    if (!hasWebGL()) return;
    let alive = true;
    const list = PLATE_SIZES[unit];
    const largest = list[0];
    const run = () => {
      void import("./three/bakePlateSprite")
        .then(({ bakePlateSprite }) => {
          if (!alive) return;
          const next: Record<number, HTMLCanvasElement> = {};
          for (const value of list) {
            next[value] = bakePlateSprite(
              value,
              unit,
              plateChipPx(value, largest),
            );
          }
          setSprites(next);
        })
        .catch(() => {
          /* Keep the 2D bumper fallback. */
        });
    };
    run();
    if (typeof document !== "undefined" && document.fonts?.status !== "loaded") {
      void document.fonts.ready.then(() => {
        if (alive) run();
      });
    }
    return () => {
      alive = false;
    };
  }, [unit]);

  return (
    <div className="flex flex-nowrap items-end justify-center gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {sizes.map((value) => {
        const d = plateChipPx(value, max);
        const count = counts.get(value) ?? 0;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onAdd(value)}
            aria-label={`Add ${formatWeight(value)} ${unit} plate to each side`}
            className="flex min-h-11 min-w-11 flex-col items-center justify-end gap-0.5 rounded-md py-1 transition-transform duration-150 ease-out select-none motion-reduce:transition-none motion-reduce:active:scale-100 active:scale-[0.97]"
          >
            <PlateThumb
              value={value}
              unit={unit}
              size={d}
              sprite={sprites[value] ?? null}
            />
            <span className="tnum h-5 text-[13px] text-muted">
              {count > 0 ? `×${count}` : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}