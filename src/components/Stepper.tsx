import { useId, useRef, useState } from "react";
import { formatWeight } from "../lib/workout";

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
  /** `lead` matches the live weight numeral. `compact` is the reps companion. */
  size?: "default" | "compact" | "lead";
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
  size = "default",
}: StepperProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

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
  const suffixClass =
    size === "lead" || (readout && size !== "compact")
      ? "ml-1.5 text-sm text-muted"
      : "ml-1 text-[13px] font-medium text-muted";

  const commit = (text: string) => {
    const parsed = parseDraft(text);
    if (parsed !== null) onChange(clamp(parsed, min, max));
    setEditing(false);
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
      className={`numeral tnum text-center font-semibold tracking-tight text-ink ${valueSize}`}
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
        className="inline-flex min-h-11 items-center justify-center whitespace-nowrap"
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
