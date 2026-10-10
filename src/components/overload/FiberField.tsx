import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { buildPlate } from "../../lib/anatomy";
import {
  FIBER_CLASS_LABEL,
  FIBER_CLASS_NOTE,
  FIBER_CLASSES,
  type FiberClass,
} from "../../lib/fibers";
import type { RegionId } from "../../lib/muscleRegions";
import { ChunkErrorBoundary, hasWebGL } from "../weight/three/fallback";

const loadFiberField3D = () =>
  import("./FiberField3D").then((m) => ({ default: m.FiberField3D }));
const FiberField3D = lazy(loadFiberField3D);
void loadFiberField3D();

const TONE: Record<FiberClass, string> = {
  I: "var(--fiber-i)",
  IIa: "var(--fiber-iia)",
  IIx: "var(--fiber-iix)",
};

/** Low-threshold fibres light first, so the sweep runs in recruitment order. */
const STAGGER_MS = 420;

interface FiberFieldProps {
  region: RegionId;
  /** Index of the bundle this variation leans on. */
  emphasis: number;
  /** Share working from the opening rep under the numbers on the stage. */
  stageOnset: number;
  /** Share working from the opening rep under the recommendation. */
  onset: number;
  /** Share the recommended set reaches by its last rep. */
  ceiling: number;
  /** A new value re-runs the light-up. */
  runKey: string;
  label: string;
}

/**
 * The targeted muscle as a 3D volume, with its own fascicles lit in
 * recruitment order. Without WebGL the 2D plate remains.
 */
export function FiberField(props: FiberFieldProps) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(() => !hasWebGL());
  const plate = <FiberPlate {...props} />;

  useEffect(() => {
    setReady(false);
  }, [props.region, props.emphasis]);

  if (failed) return plate;

  return (
    <ChunkErrorBoundary fallback={plate}>
      <div className="fiber-field">
        {!ready && plate}
        <div className={ready ? "h-full" : "pointer-events-none absolute inset-0 opacity-0"}>
          <Suspense fallback={null}>
            <FiberField3D
              {...props}
              onReady={() => setReady(true)}
              onFail={() => setFailed(true)}
            />
          </Suspense>
        </div>
      </div>
    </ChunkErrorBoundary>
  );
}

/**
 * The targeted muscle as the anatomical plate draws it, with its own
 * fascicles lit in recruitment order. Neighbours stay in the window so the
 * muscle is placed on the body rather than floating.
 */
export function FiberPlate({
  region,
  emphasis,
  stageOnset,
  onset,
  ceiling,
  runKey,
  label,
}: FiberFieldProps) {
  const plate = useMemo(() => buildPlate(region, emphasis), [region, emphasis]);
  const gainSpan = Math.max(0.0001, onset - stageOnset);

  const drawn = plate.fascicles.map((fascicle, index) => {
    const { threshold } = fascicle;
    const gain =
      threshold >= stageOnset && threshold < onset
        ? (threshold - stageOnset) / gainSpan
        : null;
    const state =
      threshold < Math.min(onset, stageOnset)
        ? "full"
        : gain != null
          ? "gained"
          : threshold < ceiling
            ? "late"
            : "idle";
    return {
      key: index,
      d: fascicle.d,
      tone: TONE[fascicle.klass],
      state,
      delay: gain == null ? 0 : Math.round(gain * STAGGER_MS),
    };
  });

  return (
    <svg
      key={runKey}
      className="fiber-plate"
      viewBox={plate.crop.join(" ")}
      role="img"
      aria-label={label}
    >
      {plate.under.map((d, i) => (
        <path key={`u${i}`} className="plate-near" d={d} />
      ))}
      {plate.belly.map((d, i) => (
        <path key={`b${i}`} className="plate-belly" d={d} />
      ))}
      {drawn.map((fascicle) => (
        <path
          key={fascicle.key}
          className={`fiber fiber-${fascicle.state}`}
          d={fascicle.d}
          pathLength={1}
          style={
            {
              "--fiber-tone": fascicle.tone,
              animationDelay: `${fascicle.delay}ms`,
            } as React.CSSProperties
          }
        />
      ))}
      {plate.belly.map((d, i) => (
        <path key={`e${i}`} className="plate-edge" d={d} />
      ))}
      {plate.over.map((d, i) => (
        <path key={`o${i}`} className="plate-near" d={d} />
      ))}
    </svg>
  );
}

/**
 * The colour key, which also reads out how deep the set goes: classes working
 * from the opening rep are inked, the rest stay muted. Never colour alone.
 * Each key explains itself: hover with a pointer, tap on touch, focus from
 * the keyboard.
 */
export function FiberLegend({ deepest }: { deepest: FiberClass | null }) {
  const reachedIndex = deepest ? FIBER_CLASSES.indexOf(deepest) : -1;
  const [open, setOpen] = useState<FiberClass | null>(null);
  const rootRef = useRef<HTMLUListElement>(null);
  const noteRef = useRef<HTMLParagraphElement>(null);
  const openedBy = useRef<"mouse" | "touch" | "key" | null>(null);

  // The note is wider than its key. Centre it on the key, then slide it so it
  // stays inside the row rather than off the card.
  useLayoutEffect(() => {
    const note = noteRef.current;
    const root = rootRef.current;
    const button = note?.previousElementSibling;
    if (!open || !note || !root || !(button instanceof HTMLElement)) return;
    const rootBox = root.getBoundingClientRect();
    note.style.left = "0px";
    note.style.right = "auto";
    note.style.translate = "none";
    note.style.maxWidth = "";
    if (note.offsetWidth > rootBox.width) note.style.maxWidth = `${rootBox.width}px`;
    const noteWidth = note.offsetWidth;
    const buttonBox = button.getBoundingClientRect();
    const desired = buttonBox.left + buttonBox.width / 2 - noteWidth / 2;
    const clamped = Math.max(
      rootBox.left,
      Math.min(desired, rootBox.right - noteWidth),
    );
    const liBox = note.parentElement?.getBoundingClientRect() ?? buttonBox;
    note.style.left = `${clamped - liBox.left}px`;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      openedBy.current = null;
      setOpen(null);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      openedBy.current = null;
      setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <ul
      ref={rootRef}
      className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1"
    >
      {FIBER_CLASSES.map((klass, index) => {
        const reached = index <= reachedIndex;
        const shown = open === klass;
        return (
          <li
            key={klass}
            className="relative"
            onPointerEnter={(event) => {
              if (event.pointerType !== "mouse") return;
              openedBy.current = "mouse";
              setOpen(klass);
            }}
            onPointerLeave={(event) => {
              if (event.pointerType !== "mouse") return;
              if (openedBy.current !== "mouse") return;
              openedBy.current = null;
              setOpen((current) => (current === klass ? null : current));
            }}
          >
            <button
              type="button"
              className={[
                "fiber-legend-btn",
                reached ? "text-ink" : "text-muted",
              ].join(" ")}
              aria-describedby={`fiber-note-${klass}`}
              onPointerDown={(event) => {
                event.currentTarget.dataset.pointer = event.pointerType;
              }}
              onClick={(event) => {
                const kind = event.currentTarget.dataset.pointer;
                delete event.currentTarget.dataset.pointer;
                // Keyboard activation has no pointer. A mouse click is already
                // covered by hover, so only a finger or pen toggles.
                if (!kind || kind === "mouse" || event.detail === 0) return;
                openedBy.current = "touch";
                setOpen((current) => (current === klass ? null : klass));
              }}
              onFocus={(event) => {
                if (!event.currentTarget.matches(":focus-visible")) return;
                openedBy.current = "key";
                setOpen(klass);
              }}
              onBlur={() => {
                if (openedBy.current !== "key") return;
                openedBy.current = null;
                setOpen((current) => (current === klass ? null : current));
              }}
            >
              <span
                className={reached ? "fiber-key fiber-key-on" : "fiber-key"}
                style={{ "--fiber-tone": TONE[klass] } as React.CSSProperties}
                aria-hidden="true"
              />
              <span className="fiber-legend-word">{FIBER_CLASS_LABEL[klass]}</span>
              <span className="sr-only">
                {reached ? ", under load from rep one" : ", held in reserve"}
              </span>
            </button>
            <p
              id={`fiber-note-${klass}`}
              role="tooltip"
              data-open={shown ? "true" : "false"}
              className="fiber-note"
              ref={shown ? noteRef : undefined}
            >
              {FIBER_CLASS_NOTE[klass]}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
