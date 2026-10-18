import {
  createContext,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { usePagerGesture } from "../hooks/usePagerGesture";

interface LogActionSwipeProps {
  /** A set exists to drop onto. Otherwise the control is only Log. */
  canDrop: boolean;
  logLabel: string;
  dropAria: string;
  onLog: () => void;
  onDrop: () => void;
  /** The live weight and reps. They are the button. */
  children?: ReactNode;
}

/** A tap inside the pill logs. A drag on a numeral does not. */
export const LogPillContext = createContext<{
  skipClick: { current: boolean };
  onLog: () => void;
} | null>(null);

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Short tick on the press. Unsupported browsers and iOS Safari no-op. */
function clickHaptic() {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return;
  }
  try {
    navigator.vibrate(12);
  } catch {
    /* Vibration throws when the document is not allowed to vibrate. */
  }
}

const PAGES = [
  { id: "drop-prev", kind: "drop" },
  { id: "log", kind: "log" },
  { id: "drop-next", kind: "drop" },
] as const;

function PillFace({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <div className="log-pill">
      <button
        type="button"
        className="log-pill-hit"
        aria-label={label}
        onClick={onClick}
      />
      <div className="log-pill-face">
        <span className="log-pill-sheen" aria-hidden="true" />
        <div className="flex min-w-0 items-center whitespace-nowrap">{children}</div>
      </div>
    </div>
  );
}

function DropFace({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="log-pill log-pill-drop" onClick={onClick} aria-label={label}>
      <span className="log-pill-face">
        <span className="log-pill-sheen" aria-hidden="true" />
        <span className="text-[15px] font-medium text-ink">Drop</span>
      </span>
    </button>
  );
}

/**
 * The live weight × reps is the log control: a frosted metal pill.
 * A sideways swipe, either way, slides into Drop. A drag on a numeral
 * still changes that number, and does not log.
 */
export function LogActionSwipe({
  canDrop,
  logLabel,
  dropAria,
  onLog,
  onDrop,
  children,
}: LogActionSwipeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const logPageRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(1);
  const draggingRef = useRef(false);
  const skipClick = useRef(false);
  const [index, setIndex] = useState(1);

  const log = useCallback(() => {
    clickHaptic();
    onLog();
  }, [onLog]);

  const drop = useCallback(() => {
    clickHaptic();
    onDrop();
  }, [onDrop]);

  const onShellClick = (event: MouseEvent) => {
    if (skipClick.current) {
      skipClick.current = false;
      return;
    }
    const target = event.target;
    if (target instanceof Element && target.closest("button, a")) return;
    log();
  };

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
    const page = logPageRef.current;
    const viewport = viewportRef.current;
    if (!page || !viewport) return;
    const sync = () => {
      const width = page.offsetWidth;
      if (width <= 0) return;
      viewport.style.width = `${width}px`;
      viewport.querySelectorAll<HTMLElement>(".log-pill-page").forEach((el) => {
        if (el === page) return;
        el.style.width = `${width}px`;
      });
      paint(progressRef.current, draggingRef.current);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(page);
    return () => ro.disconnect();
  }, [canDrop, paint, children]);

  const gesture = { skipClick, onLog: log };

  if (!canDrop) {
    return (
      <LogPillContext.Provider value={gesture}>
        <div data-log-bar="" onClick={onShellClick}>
          <PillFace label={logLabel} onClick={log}>
            {children}
          </PillFace>
        </div>
      </LogPillContext.Provider>
    );
  }

  return (
    <LogPillContext.Provider value={gesture}>
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
        onClick={onShellClick}
      >
        <div ref={viewportRef} className="log-pill-clip">
          <div
            ref={trackRef}
            className="log-pill-track"
            style={{ transform: "translate3d(-33.333333%, 0, 0)" }}
          >
            {PAGES.map((page, i) => {
              const active = i === index;
              const isDrop = page.kind === "drop";
              return (
                <div
                  key={page.id}
                  ref={page.kind === "log" ? logPageRef : undefined}
                  className="log-pill-page"
                  aria-hidden={!active}
                  {...(!active ? { inert: "" } : {})}
                >
                  {isDrop ? (
                    <DropFace label={dropAria} onClick={drop} />
                  ) : (
                    <PillFace label={logLabel} onClick={log}>
                      {children}
                    </PillFace>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </LogPillContext.Provider>
  );
}
