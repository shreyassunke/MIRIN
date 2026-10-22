import {
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { formatWeight } from "../lib/workout";
import { LogPillContext } from "./LogActionSwipe";
import { REEL_STEP_PX, reelSnap, settleReel } from "./reel";

/** Same claim and travel as the weight stage drag. Up increases. */
const DRAG_TAP_PX = 12;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function tickHaptic() {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return;
  }
  try {
    navigator.vibrate(8);
  } catch {
    /* Vibration throws when the document is not allowed to vibrate. */
  }
}

function easeOutExpo(t: number) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return 1 - Math.pow(2, -10 * t);
}

interface StepperProps {
  label: string;
  value: number;
  step: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  /** Custom value rendering (feet and inches, units, and so on). */
  format?: (value: number) => string;
  /** `inline` puts the value between the buttons. `stacked` keeps the value on its own row so it can sit between mode arrows. `readout` is only the live numeral — tap it to type. */
  layout?: "default" | "inline" | "stacked" | "readout";
  /** Unit or suffix shown beside the value in inline layout. */
  inlineSuffix?: string;
  /** Extra class on the suffix, so a parent can mark it while a gesture is live. */
  suffixClassName?: string;
  /** `lead` matches the live weight numeral. `compact` is the reps companion. */
  size?: "default" | "compact" | "lead";
  /**
   * Vertical drag steps the value. A tap still opens the field.
   * A sideways drag is left for the exercise swipe.
   */
  drag?: boolean;
  /**
   * Next value for one step of a vertical drag. Finger up is +1.
   * Absent, the drag adds `step`.
   */
  onDragStep?: (direction: -1 | 1, value: number) => number;
}

function parseDraft(text: string): number | null {
  const parsed = parseFloat(text.trim().replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, min: number, max?: number) {
  let next = Math.max(min, value);
  if (max !== undefined) next = Math.min(max, next);
  return next;
}

export function Stepper({
  label,
  value,
  step,
  min = 0,
  max,
  onChange,
  format,
  layout = "default",
  inlineSuffix,
  suffixClassName,
  size = "default",
  drag = false,
  onDragStep,
}: StepperProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef(value);
  const dragRef = useRef<{
    pointerId: number;
    x: number;
    downY: number;
    y: number;
    captured: boolean;
    discarded: boolean;
    carried: boolean;
  } | null>(null);
  const reelOffsetRef = useRef(0);
  const snapRef = useRef<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [reel, setReel] = useState({ live: false, offset: 0 });
  const pill = useContext(LogPillContext);
  const holdRef = useRef<number | null>(null);
  valueRef.current = value;

  const clearHold = () => {
    if (holdRef.current == null) return;
    window.clearTimeout(holdRef.current);
    holdRef.current = null;
  };

  const stopSnap = () => {
    if (snapRef.current == null) return;
    cancelAnimationFrame(snapRef.current);
    snapRef.current = null;
  };

  const setOffset = (offset: number, live = true) => {
    reelOffsetRef.current = offset;
    setReel({ live, offset });
  };

  useEffect(
    () => () => {
      clearHold();
      stopSnap();
    },
    [],
  );

  const display = format ? format(value) : formatWeight(value);
  const shown = editing ? draft : display;
  const readout = layout === "readout";
  const btn =
    size === "default"
      ? "glass-btn flex h-12 w-12 items-center justify-center rounded-pill text-xl leading-none text-ink"
      : "glass-btn flex h-11 w-11 items-center justify-center rounded-pill text-lg leading-none text-ink";
  const valueSize =
    size === "lead" || (readout && size !== "compact")
      ? "h-11 text-3xl leading-none"
      : size === "compact"
        ? "h-11 text-base leading-none"
        : "h-12 text-xl leading-none";
  const suffixClass = [
    size === "lead" || (readout && size !== "compact")
      ? "ml-1.5 text-sm text-muted"
      : "ml-1 text-[13px] font-medium text-muted",
    suffixClassName,
  ]
    .filter(Boolean)
    .join(" ");

  const commit = (text: string) => {
    const parsed = parseDraft(text);
    if (parsed !== null) onChange(clamp(parsed, min, max));
    setEditing(false);
  };

  const preview = (direction: -1 | 1, from = valueRef.current) => {
    const raw = onDragStep ? onDragStep(direction, from) : from + direction * step;
    return clamp(raw, min, max);
  };

  const stepBy = (direction: -1 | 1) => {
    const next = preview(direction);
    if (next === valueRef.current) return false;
    valueRef.current = next;
    onChange(next);
    tickHaptic();
    return true;
  };

  const markReel = (host: HTMLElement, on: boolean) => {
    host.closest(".log-pill")?.classList.toggle("is-reeling", on);
  };

  const finishReel = (host: HTMLElement, offset: number) => {
    if (!pill) {
      setOffset(0, false);
      return;
    }
    const decision = reelSnap(offset, REEL_STEP_PX, (direction) => preview(direction) !== valueRef.current);
    if (!decision.direction && Math.abs(offset) < 0.5) {
      setOffset(0, false);
      markReel(host, false);
      return;
    }
    if (prefersReducedMotion()) {
      if (decision.direction) stepBy(decision.direction);
      setOffset(0, false);
      markReel(host, false);
      return;
    }
    stopSnap();
    const from = offset;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 180);
      const next = from + (decision.target - from) * easeOutExpo(t);
      if (t < 1) {
        setOffset(next);
        snapRef.current = requestAnimationFrame(tick);
        return;
      }
      snapRef.current = null;
      if (decision.direction) stepBy(decision.direction);
      setOffset(0, false);
      markReel(host, false);
    };
    setOffset(from);
    snapRef.current = requestAnimationFrame(tick);
  };

  const onDragDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag || editing || event.button !== 0) return;
    event.preventDefault();
    stopSnap();
    const carried = reelOffsetRef.current;
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      downY: event.clientY,
      y: event.clientY - carried,
      captured: false,
      discarded: false,
      carried: Math.abs(carried) > 0.5,
    };
    if (pill) {
      clearHold();
      holdRef.current = window.setTimeout(() => {
        const start = dragRef.current;
        if (!start || start.captured || start.discarded) return;
        pill.skipClick.current = true;
        setOffset(0, false);
        markReel(event.currentTarget, false);
        inputRef.current?.focus();
      }, 450);
    }
  };

  const onDragMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragRef.current;
    if (!start || start.pointerId !== event.pointerId || start.discarded) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.downY;
    if (Math.hypot(dx, dy) > 4) clearHold();
    if (!start.captured) {
      const travel = Math.hypot(dx, dy);
      if (travel <= DRAG_TAP_PX) {
        if (!start.carried) return;
      } else if (Math.abs(dx) > Math.abs(dy)) {
        start.discarded = true;
        finishReel(event.currentTarget, reelOffsetRef.current);
        return;
      } else {
        start.captured = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        inputRef.current?.blur();
        setEditing(false);
        if (pill) markReel(event.currentTarget, true);
      }
    }
    event.preventDefault();
    const remain = event.clientY - start.y;
    const settled = settleReel(remain, REEL_STEP_PX, preview, valueRef.current);
    if (settled.steps.length > 0) {
      for (const direction of settled.steps) stepBy(direction);
      start.y += settled.steps.reduce((px, direction) => px - direction * REEL_STEP_PX, 0);
    }
    // Outside the pill the digit still steps. Reduced motion skips the track.
    if (!pill || prefersReducedMotion()) return;
    setOffset(settled.offset);
  };

  const onDragEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    dragRef.current = null;
    clearHold();
    const host = event.currentTarget;
    if (host.hasPointerCapture(event.pointerId)) {
      host.releasePointerCapture(event.pointerId);
    }
    if (start.captured || start.discarded || start.carried) {
      if (pill) pill.skipClick.current = true;
      if (!start.discarded) finishReel(host, reelOffsetRef.current);
      return;
    }
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.downY;
    if (Math.hypot(dx, dy) > DRAG_TAP_PX) {
      // A flick can arrive as down then up, with no move in between.
      if (Math.abs(dy) <= Math.abs(dx)) return;
      const settled = settleReel(
        event.clientY - start.y,
        REEL_STEP_PX,
        preview,
        valueRef.current,
      );
      for (const direction of settled.steps) stepBy(direction);
      if (pill) pill.skipClick.current = true;
      if (pill && !prefersReducedMotion()) finishReel(host, settled.offset);
      return;
    }
    if (pill) {
      if (pill.skipClick.current) return;
      pill.skipClick.current = true;
      if (document.activeElement === inputRef.current) return;
      pill.onLog();
      return;
    }
    inputRef.current?.focus();
  };

  const suffix =
    (readout || layout === "inline" || layout === "stacked") && inlineSuffix ? (
      <span className={suffixClass}>{inlineSuffix}</span>
    ) : null;

  const valueControl = (
    <input
      ref={inputRef}
      id={inputId}
      type="text"
      inputMode="decimal"
      enterKeyHint="done"
      autoComplete="off"
      aria-label={label || "Value"}
      value={shown}
      size={Math.max(shown.length, 1)}
      onFocus={() => {
        setDraft(String(value));
        setEditing(true);
        requestAnimationFrame(() => inputRef.current?.select());
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setDraft(String(value));
          setEditing(false);
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={`numeral tnum text-center font-semibold tracking-tight text-ink ${valueSize}${drag ? " cursor-ns-resize" : ""}`}
    />
  );

  const decrease = (
    <button
      type="button"
      className={btn}
      aria-label={`Decrease ${label}`}
      onClick={() => onChange(clamp(value - step, min, max))}
    >
      &minus;
    </button>
  );
  const increase = (
    <button
      type="button"
      className={btn}
      aria-label={`Increase ${label}`}
      onClick={() => onChange(clamp(value + step, min, max))}
    >
      +
    </button>
  );

  if (layout === "readout") {
    const textFor = (next: number) => (format ? format(next) : formatWeight(next));
    const lower = preview(-1);
    const higher = preview(1);
    const lowerText = lower === value ? "" : textFor(lower);
    const higherText = higher === value ? "" : textFor(higher);
    const widest = [textFor(value), lowerText, higherText].reduce((best, text) =>
      text.length > best.length ? text : best,
    );
    const reelType =
      size === "lead" || size !== "compact"
        ? "text-3xl"
        : "text-base";
    const showReel = Boolean(pill) && reel.live && !editing;
    return (
      <div
        data-no-pager=""
        onPointerDown={drag ? onDragDown : undefined}
        onMouseDown={drag ? (event) => event.preventDefault() : undefined}
        onPointerMove={drag ? onDragMove : undefined}
        onPointerUp={drag ? onDragEnd : undefined}
        onPointerCancel={drag ? onDragEnd : undefined}
        className={[
          "inline-flex min-h-11 items-center justify-center whitespace-nowrap",
          drag ? "cursor-ns-resize touch-none" : "",
        ].join(" ")}
      >
        {showReel ? (
          <span className="numeral-reel">
            <span className={`numeral-reel-sizer tnum font-semibold tracking-tight ${reelType}`}>
              {widest}
            </span>
            <span
              className="numeral-reel-track"
              style={{
                transform: `translate3d(0, calc(-50% + ${reel.offset}px), 0)`,
              }}
            >
              <span className={`numeral-reel-slot tnum font-semibold tracking-tight ${reelType}`} aria-hidden="true">
                {lowerText}
              </span>
              {valueControl}
              <span className={`numeral-reel-slot tnum font-semibold tracking-tight ${reelType}`} aria-hidden="true">
                {higherText}
              </span>
            </span>
          </span>
        ) : (
          valueControl
        )}
        {suffix}
      </div>
    );
  }

  if (layout === "stacked") {
    return (
      <div className="flex flex-col items-center gap-2">
        <span className="inline-flex items-center">
          {valueControl}
          {suffix}
        </span>
        <div className="flex w-44 items-center justify-between">
          {decrease}
          {increase}
        </div>
      </div>
    );
  }

  const controls = (
    <div className="flex items-center gap-1.5">
      {decrease}
      <span className="inline-flex items-center">
        {valueControl}
        {suffix}
      </span>
      {increase}
    </div>
  );

  if (layout === "inline") return controls;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[13px] font-medium text-muted">{label}</span>
      {controls}
    </div>
  );
}
