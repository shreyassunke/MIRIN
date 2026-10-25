import {
  createContext,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import { usePagerGesture } from "../hooks/usePagerGesture";
import { tintedMetalUrl } from "./weight/three/metalType";
import { RestReadout, useRestClock } from "./RestTimer";

interface LogActionSwipeProps {
  /** A set exists to drop onto. Otherwise the control is only Log. */
  canDrop: boolean;
  logLabel: string;
  dropAria: string;
  onLog: () => void;
  onDrop: () => void;
  /** This pill carries the rest clock. It starts when a set is logged. */
  rest?: boolean;
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

/*
  Log pill v1 (machined key). Kept for rollback.
  Restore RING_INSET, PillFace, and DropFace below, plus the
  stadiumLength and stadiumPath imports from ./RestTimer.
  The matching CSS is the "Log pill v1" block in index.css.

  const RING_INSET = 1.25;

  function PillFace({ children, label, onClick, rest }) {
    const faceRef = useRef(null);
    const clock = useRestClock();
    const show = rest && clock != null && clock.remaining > 0;
    const [size, setSize] = useState({ w: 0, h: 0 });

    useLayoutEffect(() => {
      const el = faceRef.current;
      if (!el || !show) return;
      const sync = () => {
        const rect = el.getBoundingClientRect();
        setSize({ w: rect.width, h: rect.height });
      };
      sync();
      const ro = new ResizeObserver(sync);
      ro.observe(el);
      return () => ro.disconnect();
    }, [show]);

    const length = size.w > 0 ? stadiumLength(size.w, size.h, RING_INSET) : 0;
    const progress =
      show && clock && clock.total > 0
        ? Math.min(1, clock.remaining / clock.total)
        : 0;

    return (
      <div ref={faceRef} className={show ? "log-pill is-rest" : "log-pill"}>
        {show && length > 0 && (
          <svg className="log-pill-ring" viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden="true">
            <path className="log-pill-ring-track" d={stadiumPath(size.w, size.h, RING_INSET)} />
            <path
              className="log-pill-ring-value"
              d={stadiumPath(size.w, size.h, RING_INSET)}
              strokeDasharray={length}
              strokeDashoffset={length * (1 - progress)}
            />
          </svg>
        )}
        {!show && (
          <button type="button" className="log-pill-hit" aria-label={label} onClick={onClick} />
        )}
        <div className="log-pill-face">
          <span className="log-pill-sheen" aria-hidden="true" />
          <div
            className="log-pill-slot"
            aria-hidden={show || undefined}
            {...(show ? { inert: "" } : {})}
          >
            {children}
          </div>
          {show && clock && (
            <RestReadout
              remaining={clock.remaining}
              onDismiss={clock.dismiss}
              onNudge={clock.nudge}
            />
          )}
        </div>
      </div>
    );
  }

  function DropFace({ label, onClick }) {
    return (
      <button type="button" className="log-pill log-pill-drop" onClick={onClick} aria-label={label}>
        <span className="log-pill-face">
          <span className="log-pill-sheen" aria-hidden="true" />
          <span className="text-[15px] font-medium text-ink">Drop</span>
        </span>
      </button>
    );
  }
*/

function FigureFace({
  children,
  label,
  onClick,
  rest,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  rest: boolean;
}) {
  const faceRef = useRef<HTMLDivElement>(null);
  const clock = useRestClock();
  const show = rest && clock != null && clock.remaining > 0;
  const progress =
    show && clock && clock.total > 0
      ? Math.min(1, clock.remaining / clock.total)
      : 0;

  useLayoutEffect(() => {
    const el = faceRef.current;
    if (!el) return;
    const fit = () => {
      const slot = el.querySelector<HTMLElement>(".log-figure-slot");
      if (!slot) return;
      const available = el.clientWidth;
      const needed = slot.scrollWidth;
      const scale = available > 0 && needed > available ? available / needed : 1;
      el.style.setProperty("--figure-scale", scale.toFixed(4));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    const slot = el.querySelector(".log-figure-slot");
    if (slot) ro.observe(slot);
    return () => ro.disconnect();
  }, [show]);

  useEffect(() => {
    const el = faceRef.current;
    if (!el) return;
    const apply = () => {
      const url = tintedMetalUrl(getComputedStyle(el).color);
      if (url) el.style.setProperty("--figure-metal", `url("${url}")`);
    };
    apply();
    const mode = new MutationObserver(apply);
    mode.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode"] });
    return () => mode.disconnect();
  }, [show]);

  return (
    <div
      ref={faceRef}
      className={show ? "log-figure is-rest" : "log-figure"}
      style={show ? ({ "--rest": String(progress) } as CSSProperties) : undefined}
    >
      {!show && (
        <button
          type="button"
          className="log-figure-hit"
          aria-label={label}
          onClick={onClick}
        />
      )}
      <div
        className="log-figure-slot"
        aria-hidden={show || undefined}
        {...(show ? { inert: "" } : {})}
      >
        {children}
      </div>
      {show && (
        <span className="log-figure-hairline" aria-hidden="true">
          <span className="log-figure-hairline-value" />
        </span>
      )}
      {show && clock && (
        <RestReadout
          className="log-figure-rest"
          remaining={clock.remaining}
          onDismiss={clock.dismiss}
          onNudge={clock.nudge}
        />
      )}
    </div>
  );
}

function DropWord({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="log-figure log-figure-drop"
      onClick={onClick}
      aria-label={label}
    >
      Drop
    </button>
  );
}

/**
 * The live weight × reps is the log control: chromeless figures.
 * A vertical drag on either numeral reels that number and does not log.
 * A sideways swipe, either way, slides into Drop. A tap logs.
 */
export function LogActionSwipe({
  canDrop,
  logLabel,
  dropAria,
  onLog,
  onDrop,
  rest = false,
  children,
}: LogActionSwipeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
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
    if (
      target instanceof Element &&
      target.closest(".log-figure.is-rest, button, a")
    ) {
      return;
    }
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
    const viewport = viewportRef.current;
    if (!viewport) return;
    const sync = () => paint(progressRef.current, draggingRef.current);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(viewport);
    return () => ro.disconnect();
  }, [canDrop, paint]);

  const gesture = { skipClick, onLog: log };

  if (!canDrop) {
    return (
      <LogPillContext.Provider value={gesture}>
        <div data-log-bar="" onClick={onShellClick}>
          <FigureFace label={logLabel} onClick={log} rest={rest}>
            {children}
          </FigureFace>
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
        <div ref={viewportRef} className="log-figure-clip">
          <div
            ref={trackRef}
            className="log-figure-track"
            style={{ transform: "translate3d(-33.333333%, 0, 0)" }}
          >
            {PAGES.map((page, i) => {
              const active = i === index;
              const isDrop = page.kind === "drop";
              return (
                <div
                  key={page.id}
                  className="log-figure-page"
                  aria-hidden={!active}
                  {...(!active ? { inert: "" } : {})}
                >
                  {isDrop ? (
                    <DropWord label={dropAria} onClick={drop} />
                  ) : (
                    <FigureFace label={logLabel} onClick={log} rest={rest}>
                      {children}
                    </FigureFace>
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
