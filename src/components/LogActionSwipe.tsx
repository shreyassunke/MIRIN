import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { usePagerGesture } from "../hooks/usePagerGesture";

interface LogActionSwipeProps {
  /** A set exists to drop onto. Otherwise the control is only Log. */
  canDrop: boolean;
  logLabel: string;
  dropAria: string;
  onLog: () => void;
  onDrop: () => void;
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

const PAGES = [
  { id: "drop-prev", kind: "drop" },
  { id: "log", kind: "log" },
  { id: "drop-next", kind: "drop" },
] as const;

function LogFace({
  drop,
  label,
  onClick,
}: {
  drop: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={
        drop
          ? "log-face glass-btn h-11 w-11 text-[12px] font-medium leading-none text-ink"
          : "log-face btn-primary h-11 w-11"
      }
    >
      {drop ? (
        "Drop"
      ) : (
        <span className="log-emblem">
          <span className="log-logo" aria-hidden="true" />
        </span>
      )}
    </button>
  );
}

/**
 * Log is a machined coin with the MIRIN figure struck into the face.
 * A sideways swipe, either way, slides into the same drop action.
 * The finger owns the track. The coin's press lives on the face, so a
 * swipe does not scale the track.
 */
export function LogActionSwipe({
  canDrop,
  logLabel,
  dropAria,
  onLog,
  onDrop,
}: LogActionSwipeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(1);
  const draggingRef = useRef(false);
  const [index, setIndex] = useState(1);

  const paint = useCallback((progress: number, dragging: boolean) => {
    progressRef.current = progress;
    draggingRef.current = dragging;
    const track = trackRef.current;
    const viewport = viewportRef.current;
    const reduced = prefersReducedMotion();
    const width = viewport?.clientWidth ?? 0;
    if (track) {
      const x = reduced ? -Math.round(progress) * width : -progress * width;
      track.style.transform = width
        ? `translate3d(${x}px, 0, 0)`
        : `translate3d(${-progress * 33.333333}%, 0, 0)`;
    }
    rootRef.current?.classList.toggle("is-paging", dragging);
  }, []);

  usePagerGesture({
    count: PAGES.length,
    index,
    enabled: canDrop,
    rootRef,
    onProgress: paint,
    onIndexChange: setIndex,
    getWidth: () => viewportRef.current?.clientWidth ?? 1,
    claim: "page",
  });

  useLayoutEffect(() => {
    if (!canDrop) return;
    paint(progressRef.current, false);
    const viewport = viewportRef.current;
    if (!viewport) return;
    const ro = new ResizeObserver(() =>
      paint(progressRef.current, draggingRef.current),
    );
    ro.observe(viewport);
    return () => ro.disconnect();
  }, [canDrop, paint]);

  if (!canDrop) {
    return (
      <div data-log-bar="">
        <LogFace drop={false} label={logLabel} onClick={onLog} />
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      data-log-bar=""
      className="log-action load-swipe-field"
      role="group"
      aria-label={
        index === 1
          ? "Log set. Swipe sideways to add a drop."
          : "Drop set. Swipe back to log."
      }
    >
      <div ref={viewportRef} className="h-11 w-11 overflow-hidden rounded-full">
        <div
          ref={trackRef}
          className="flex h-full will-change-transform"
          style={{ width: "300%", transform: "translate3d(-33.333333%, 0, 0)" }}
        >
          {PAGES.map((page, i) => {
            const active = i === index;
            const drop = page.kind === "drop";
            return (
              <div
                key={page.id}
                className="h-full w-1/3 shrink-0"
                aria-hidden={!active}
                {...(!active ? { inert: "" } : {})}
              >
                <LogFace
                  drop={drop}
                  label={drop ? dropAria : logLabel}
                  onClick={drop ? onDrop : onLog}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
