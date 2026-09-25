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
  const readout = layout === "readout";
  const btn =
    size === "default"
      ? "glass-btn flex h-12 w-12 items-center justify-center rounded-pill text-xl leading-none text-ink"
      : "glass-btn flex h-11 w-11 items-center justify-center rounded-pill text-lg leading-none text-ink";
  const valueSize = readout
    ? "text-3xl leading-none"
    : size === "lead"
      ? "h-11 min-w-[5.5rem] text-3xl leading-none"
      : size === "compact"
        ? "h-11 min-w-14 text-base"
        : "h-12 min-w-[4.75rem] text-xl";
  const valueClass = readout
    ? "tnum w-full border-0 bg-transparent p-0 text-center text-3xl font-semibold leading-none tracking-tight text-ink outline-none"
    : `tnum ${valueSize} rounded-md border border-transparent bg-transparent px-1 text-center font-semibold tracking-tight text-ink focus:border-hairline focus:bg-bg`;
  const suffixClass =
    size === "lead" || readout
      ? "ml-1.5 text-sm text-muted"
      : "ml-1 text-[13px] font-medium text-muted";

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

  const suffix =
    !readout && (layout === "inline" || layout === "stacked") && inlineSuffix ? (
      <span className={suffixClass}>{inlineSuffix}</span>
    ) : null;

  const valueControl = readout ? (
    <span className="inline-grid items-center">
      <span
        aria-hidden="true"
        className={`invisible col-start-1 row-start-1 tnum px-0.5 ${valueSize} font-semibold tracking-tight`}
      >
        {editing ? draft || "0" : display}
      </span>
      {editing ? (
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
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
          className={`col-start-1 row-start-1 ${valueClass}`}
        />
      ) : (
        <button
          type="button"
          id={inputId}
          aria-label={`${label || "Value"}, ${display}. Tap to type.`}
          onClick={beginEdit}
          className={`col-start-1 row-start-1 cursor-text ${valueClass}`}
        >
          {display}
        </button>
      )}
    </span>
  ) : editing ? (
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
        "inline-flex cursor-text items-center justify-center transition-colors duration-150 hover:border-hairline hover:bg-bg",
      ].join(" ")}
    >
      {display}
      {suffix}
    </button>
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
        {inlineSuffix ? (
          <span className={suffixClass}>{inlineSuffix}</span>
        ) : null}
      </div>
    );
  }

  if (layout === "stacked") {
    return (
      <div className="flex flex-col items-center gap-2">
        {valueControl}
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
      {valueControl}
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
