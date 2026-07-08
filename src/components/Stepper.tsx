import { formatWeight } from "../lib/workout";

interface StepperProps {
  label: string;
  value: number;
  step: number;
  min?: number;
  onChange: (value: number) => void;
}

export function Stepper({ label, value, step, min = 0, onChange }: StepperProps) {
  const btn =
    "h-11 w-11 rounded-md border border-hairline bg-surface text-xl leading-none text-ink transition-colors duration-150 hover:bg-surface-raised active:bg-surface-raised";
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[13px] font-medium text-muted">{label}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={btn}
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(Math.max(min, value - step))}
        >
          &minus;
        </button>
        <span className="tnum min-w-12 text-center text-xl font-semibold tracking-tight">
          {formatWeight(value)}
        </span>
        <button
          type="button"
          className={btn}
          aria-label={`Increase ${label}`}
          onClick={() => onChange(value + step)}
        >
          +
        </button>
      </div>
    </div>
  );
}
