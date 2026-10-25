import type { ReactNode } from "react";
import type { Exercise } from "../db/db";

interface TodayExercisePageProps {
  exercise: Exercise;
  inSuperset?: boolean;
  children?: ReactNode;
  title?: string;
  /** Recent direction, sitting on the name. Hidden while the title is being edited. */
  trend?: ReactNode;
  /** Opens the title editor: correct the name, or swap to another exercise. */
  onReplace?: () => void;
  /** Title editor, shown in place of the title while active. */
  replacing?: ReactNode;
}

export function TodayExercisePage({
  exercise,
  inSuperset = false,
  children,
  title,
  trend,
  onReplace,
  replacing,
}: TodayExercisePageProps) {
  const name = title ?? exercise.name;

  return (
    <div className="flex flex-col gap-2 md:gap-4" data-exercise-stage="">
      <div className="flex w-full min-w-0 items-center justify-center gap-1.5">
        {replacing ? (
          <div data-no-pager="" className="w-full min-w-0">
            {replacing}
          </div>
        ) : (
          <>
            {inSuperset && (
              <span className="shrink-0 text-muted" aria-hidden="true">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
                  <path
                    d="M6.25 5.5a2.25 2.25 0 0 1 0 3.18l-.3.3a2.25 2.25 0 1 1-3.18-3.18l.6-.6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M9.75 10.5a2.25 2.25 0 0 1 0-3.18l.3-.3a2.25 2.25 0 1 1 3.18 3.18l-.6.6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            )}
            <button
              type="button"
              data-no-pager=""
              className="inline-flex h-11 max-w-full min-w-0 items-center truncate text-lg font-semibold tracking-tight [-webkit-tap-highlight-color:transparent]"
              aria-label={`Edit ${name}`}
              onClick={onReplace}
            >
              {name}
            </button>
            {trend}
          </>
        )}
      </div>

      {children}
    </div>
  );
}
