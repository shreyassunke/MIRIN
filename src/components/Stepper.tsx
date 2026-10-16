import { useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { formatWeight } from "../lib/workout";

/** Same claim and travel as the weight stage drag. Up increases. */
const DRAG_TAP_PX = 12;
const DRAG_STEP_PX = 36;

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
   * Vertical drag steps the value, the way a drag on the model steps weight.
   * A tap still opens the field. A sideways drag is left for the exercise swipe.
   */
  drag?: boolean;
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
}: StepperProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef(value);
  const dragRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    captured: boolean;
    discarded: boolean;
  } | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  valueRef.current = value;

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

  const stepBy = (direction: -1 | 1) => {
    const next = clamp(valueRef.current + direction * step, min, max);
    if (next === valueRef.current) return;
    valueRef.current = next;
    onChange(next);
  };

  const onDragDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag || editing || event.button !== 0) return;
    event.preventDefault();
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      captured: false,
      discarded: false,
    };
  };

  const onDragMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragRef.current;
    if (!start || start.pointerId !== event.pointerId || start.discarded) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.captured) {
      if (Math.hypot(dx, dy) <= DRAG_TAP_PX) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        start.discarded = true;
        return;
      }
      start.captured = true;
      start.y = event.clientY;
      event.currentTarget.setPointerCapture(event.pointerId);
      inputRef.current?.blur();
      setEditing(false);
    }
    event.preventDefault();
    let remain = event.clientY - start.y;
    while (Math.abs(remain) >= DRAG_STEP_PX) {
      const dir = remain > 0 ? 1 : -1;
      // Finger up (negative dy) raises the count, matching the weight stage.
      stepBy((dir === 1 ? -1 : 1) as -1 | 1);
      start.y += dir * DRAG_STEP_PX;
      remain = event.clientY - start.y;
    }
  };

  const onDragEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    dragRef.current = null;
    const host = event.currentTarget;
    if (host.hasPointerCapture(event.pointerId)) {
      host.releasePointerCapture(event.pointerId);
    }
    if (start.captured || start.discarded) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.hypot(dx, dy) > DRAG_TAP_PX) return;
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
        {valueControl}
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
