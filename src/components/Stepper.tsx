import { useEffect, useId, useRef, useState } from "react";
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
  /** Inline row: value and suffix sit between the buttons, no label above. */
  layout?: "default" | "inline";
  /** Unit or suffix shown beside the value in inline layout. */
  inlineSuffix?: string;
  size?: "default" | "compact";
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
  const btn =
    size === "compact"
      ? "glass-btn flex h-11 w-11 items-center justify-center rounded-pill text-lg leading-none text-ink"
      : "glass-btn flex h-12 w-12 items-center justify-center rounded-pill text-xl leading-none text-ink";
  const valueClass =
    size === "compact"
      ? "tnum h-11 min-w-14 rounded-md border border-transparent bg-transparent px-1 text-center text-base font-semibold tracking-tight text-ink focus:border-hairline focus:bg-bg"
      : "tnum h-12 min-w-[4.75rem] rounded-md border border-transparent bg-transparent px-1 text-center text-xl font-semibold tracking-tight text-ink focus:border-hairline focus:bg-bg";

  const beginEdit = () => {
    setDraft(String(value));
    setEditing(true);
  };

  const commit = () => {
    const parsed = parseDraft(draft);
    if (parsed !== null) onChange(clamp(parsed, min, max));
    setEditing(false);
  };

  const cancel = () => {
    setDraft(String(value));
    setEditing(false);
  };

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const valueControl = editing ? (
    <input
      ref={inputRef}
      id={inputId}
      type="text"
      inputMode="decimal"
      aria-label={label || "Value"}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          cancel();
        }
      }}
      className={valueClass}
    />
  ) : (
    <button
      type="button"
      id={inputId}
      aria-label={`${label || "Value"}, ${display}. Tap to type.`}
      onClick={beginEdit}
      className={[
        valueClass,
        "cursor-text transition-colors duration-150 hover:border-hairline hover:bg-bg",
      ].join(" ")}
    >
      {display}
      {layout === "inline" && inlineSuffix ? (
        <span className="ml-1 text-[12px] font-medium text-muted">
          {inlineSuffix}
        </span>
      ) : null}
    </button>
  );

  const controls = (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        className={btn}
        aria-label={`Decrease ${label}`}
        onClick={() => onChange(clamp(value - step, min, max))}
      >
        &minus;
      </button>
      {valueControl}
      <button
        type="button"
        className={btn}
        aria-label={`Increase ${label}`}
        onClick={() =>
          onChange(clamp(value + step, min, max))
        }
      >
        +
      </button>
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
