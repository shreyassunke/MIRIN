import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

const STEP_PX = 36;
const NUDGE_SECONDS = 15;

interface RestClock {
  remaining: number;
  total: number;
  /** Vertical drag on the time. Finger up adds rest. */
  nudge: (delta: number) => void;
  dismiss: () => void;
}

const RestContext = createContext<RestClock | null>(null);

export function useRestClock() {
  return useContext(RestContext);
}

function tickHaptic() {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(12);
  } catch {
    /* The document may not be allowed to vibrate. */
  }
}

/**
 * One rest clock for the workout. The log pill reads it. A new `runId`
 * starts the countdown; changing the duration does not.
 */
export function RestClockProvider({
  active,
  runId,
  duration,
  onAdjustDuration,
  onDismiss,
  children,
}: {
  active: boolean;
  runId: number;
  duration: number;
  onAdjustDuration: (seconds: number) => void;
  onDismiss: () => void;
  children: ReactNode;
}) {
  const [remaining, setRemaining] = useState(duration);
  const [total, setTotal] = useState(duration);
  const endRef = useRef(Date.now() + duration * 1000);
  const totalRef = useRef(duration);
  const onAdjustRef = useRef(onAdjustDuration);
  const onDismissRef = useRef(onDismiss);
  const endedRef = useRef(false);
  const runSeenRef = useRef(runId);
  onAdjustRef.current = onAdjustDuration;
  onDismissRef.current = onDismiss;

  useEffect(() => {
    endRef.current = Date.now() + duration * 1000;
    totalRef.current = duration;
    endedRef.current = false;
    setRemaining(duration);
    setTotal(duration);
    // A logged set restarts the clock. An adjustment does not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      setRemaining(Math.max(0, Math.round((endRef.current - Date.now()) / 1000)));
    }, 250);
    return () => window.clearInterval(id);
  }, [active, runId]);

  useEffect(() => {
    // The restart effect clears the clock after this render, so the
    // leftover zero from the previous run is not the end of the new one.
    if (runSeenRef.current !== runId) {
      runSeenRef.current = runId;
      return;
    }
    if (!active || remaining !== 0 || endedRef.current) return;
    endedRef.current = true;
    tickHaptic();
    onDismissRef.current();
  }, [active, remaining, runId]);

  const nudge = (delta: number) => {
    endRef.current = Math.max(Date.now(), endRef.current + delta * 1000);
    const next = Math.max(NUDGE_SECONDS, totalRef.current + delta);
    totalRef.current = next;
    setTotal(next);
    setRemaining(Math.max(0, Math.round((endRef.current - Date.now()) / 1000)));
    onAdjustRef.current(next);
  };

  const value: RestClock | null = active
    ? { remaining, total, nudge, dismiss: () => onDismissRef.current() }
    : null;

  return <RestContext.Provider value={value}>{children}</RestContext.Provider>;
}

/** Stadium outline, starting at the top center and running clockwise. */
export function stadiumPath(width: number, height: number, inset: number) {
  const w = Math.max(0, width - inset * 2);
  const h = Math.max(0, height - inset * 2);
  const r = h / 2;
  const x = inset;
  const y = inset;
  const right = x + w - r;
  const left = x + r;
  const bottom = y + h;
  const top = y;
  const mid = x + w / 2;
  return `M ${mid} ${top} H ${right} A ${r} ${r} 0 0 1 ${right} ${bottom} H ${left} A ${r} ${r} 0 0 1 ${left} ${top} H ${mid}`;
}

export function stadiumLength(width: number, height: number, inset: number) {
  const w = Math.max(0, width - inset * 2);
  const h = Math.max(0, height - inset * 2);
  return 2 * Math.max(0, w - h) + Math.PI * h;
}

/** The time on the pill. Tap dismisses. A vertical drag changes the rest. */
export function RestReadout({
  remaining,
  onDismiss,
  onNudge,
  className = "log-pill-rest",
}: {
  remaining: number;
  onDismiss: () => void;
  onNudge: (delta: number) => void;
  /** Defaults to the v1 pill class so a rollback keeps its styles. */
  className?: string;
}) {
  const dragRef = useRef<{ y: number; moved: boolean } | null>(null);
  const skipClick = useRef(false);
  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, "0");
  const label = `Rest ${mm}:${ss}. Drag up or down to change it. Tap to dismiss.`;

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    dragRef.current = { y: event.clientY, moved: false };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = dragRef.current;
    if (!start) return;
    let dy = event.clientY - start.y;
    if (!start.moved) {
      if (Math.abs(dy) < 12) return;
      start.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    while (Math.abs(dy) >= STEP_PX) {
      const dir = dy > 0 ? 1 : -1;
      onNudge(dir === 1 ? -NUDGE_SECONDS : NUDGE_SECONDS);
      start.y += dir * STEP_PX;
      dy = event.clientY - start.y;
    }
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = dragRef.current;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (start?.moved) skipClick.current = true;
  };

  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={() => {
        if (skipClick.current) {
          skipClick.current = false;
          return;
        }
        onDismiss();
      }}
    >
      <span role="timer" aria-live="off">
        {mm}:{ss}
      </span>
    </button>
  );
}
