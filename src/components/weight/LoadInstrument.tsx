import type { ReactNode } from "react";
import type { InputModeOption } from "../../lib/library";
import type { InputMethod, Unit } from "../../lib/units";
import { formatWeight } from "../../lib/workout";

interface LoadInstrumentProps {
  weight: number;
  unit: Unit;
  /** Last session's matching set, already in the display unit. */
  ghost?: number | null;
  modes: InputModeOption[];
  mode: InputMethod;
  onModeChange: (mode: InputMethod) => void;
  /** Replaces the default live number (barbell bar picker). */
  weightDisplay?: ReactNode;
  /** Framed implement. Dots sit under this, then `children`. */
  stage?: ReactNode;
  children?: ReactNode;
}

export function LoadInstrument({
  weight,
  unit,
  ghost,
  modes,
  mode,
  onModeChange,
  weightDisplay,
  stage,
  children,
}: LoadInstrumentProps) {
  return (
    <div>
      <div className="mb-3 text-center" aria-live="polite">
        {weightDisplay ?? (
          <p className="flex min-h-11 items-center justify-center">
            <span className="tnum text-3xl font-semibold tracking-tight">
              {formatWeight(weight)}
            </span>
            <span className="ml-1.5 text-sm text-muted">{unit}</span>
          </p>
        )}
        {ghost != null && (
          <p className="tnum mt-0.5 text-sm text-muted">
            {formatWeight(ghost)}
          </p>
        )}
      </div>
      {stage}
      {modes.length > 1 && (
        <div
          role="group"
          aria-label="Weight input method"
          className="mt-1 flex justify-center"
        >
          {modes.map((m) => {
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                aria-label={m.label}
                aria-pressed={active}
                onClick={() => onModeChange(m.id)}
                className="flex h-11 w-11 items-center justify-center"
              >
                <span
                  className={[
                    "block h-1.5 w-1.5 rounded-full",
                    active ? "bg-ink" : "bg-muted",
                  ].join(" ")}
                />
              </button>
            );
          })}
        </div>
      )}
      {children}
    </div>
  );
}
