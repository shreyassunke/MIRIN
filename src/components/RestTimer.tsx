import { useEffect, useRef, useState } from "react";

const RING_SIZE = 44;
const RING_RADIUS = 20;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

interface RestTimerProps {
  /** Changing this key restarts the timer (a new set was logged). */
  runId: number;
  duration: number;
  onAdjustDuration: (seconds: number) => void;
  onDismiss: () => void;
}

export function RestTimer({
  runId,
  duration,
  onAdjustDuration,
  onDismiss,
}: RestTimerProps) {
  const [remaining, setRemaining] = useState(duration);
  const [total, setTotal] = useState(duration);
  const endRef = useRef(Date.now() + duration * 1000);
  const reducedMotion = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  ).current;

  useEffect(() => {
    endRef.current = Date.now() + duration * 1000;
    setRemaining(duration);
    setTotal(duration);
    // Restart only when a new set is logged, not when duration is adjusted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  useEffect(() => {
    const tick = window.setInterval(() => {
      setRemaining(
        Math.max(0, Math.round((endRef.current - Date.now()) / 1000)),
      );
    }, 250);
    return () => window.clearInterval(tick);
  }, [runId]);

  // Shift the running countdown and persist the new default for future sets.
  function adjust(delta: number) {
    endRef.current = Math.max(Date.now(), endRef.current + delta * 1000);
    setTotal((t) => Math.max(15, t + delta));
    setRemaining(Math.max(0, Math.round((endRef.current - Date.now()) / 1000)));
    onAdjustDuration(Math.max(15, duration + delta));
  }

  const done = remaining === 0;
  const progress = total > 0 ? Math.min(1, remaining / total) : 0;
  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div
      role="timer"
      aria-live="off"
      className="fixed inset-x-3 bottom-[4.75rem] z-40 mx-auto flex max-w-md items-center gap-3 rounded-xl glass px-4 py-3 shadow-glass md:bottom-6"
    >
      {!reducedMotion && (
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          className="-rotate-90 shrink-0"
          aria-hidden="true"
        >
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="#232323"
            strokeWidth="1.5"
          />
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="#d4d4d4"
            strokeWidth="1.5"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            strokeLinecap="round"
          />
        </svg>
      )}
      <div className="flex-1">
        <div className="tnum text-xl font-semibold tracking-tight">
          {done ? "Rest over" : `${mm}:${ss}`}
        </div>
        <div className="text-[13px] font-medium text-muted">Rest</div>
      </div>
      <button
        type="button"
        onClick={() => adjust(-15)}
        className="glass-btn h-11 rounded-pill px-3 text-[13px] font-medium text-ink"
      >
        &minus;15s
      </button>
      <button
        type="button"
        onClick={() => adjust(15)}
        className="glass-btn h-11 rounded-pill px-3 text-[13px] font-medium text-ink"
      >
        +15s
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss rest timer"
        className="glass-btn h-11 w-11 rounded-pill text-muted hover:text-ink"
      >
        &times;
      </button>
    </div>
  );
}
