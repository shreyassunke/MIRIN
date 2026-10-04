import { type ReactNode } from "react";
import type { Exercise, SetLog } from "../db/db";
import type { ExerciseLibraryEntry } from "../lib/library";
import { ExerciseCombobox } from "./ExerciseCombobox";

interface TodayExercisePageProps {
  exercise: Exercise;
  logged: SetLog[];
  finished: boolean;
  isSwapping: boolean;
  excludeSwapIds: string[];
  inSuperset?: boolean;
  overflow?: ReactNode;
  notes?: ReactNode;
  onCancelSwap: () => void;
  onSwapPick: (entry: ExerciseLibraryEntry) => void;
  children?: ReactNode;
  title?: string;
  position?: string;
  /** Neighbor page during a swipe — name and the next set only. */
  preview?: boolean;
  previewSet?: string;
}

export function TodayExercisePage({
  exercise,
  logged,
  finished,
  isSwapping,
  excludeSwapIds,
  inSuperset = false,
  overflow,
  notes,
  onCancelSwap,
  onSwapPick,
  children,
  title,
  position,
  preview = false,
  previewSet,
}: TodayExercisePageProps) {
  const name = title ?? exercise.name;
  const workingCount = logged.filter((s) => !s.isWarmup).length;
  const status = finished
    ? `Done · ${workingCount}`
    : workingCount > 0
      ? `${workingCount} ${workingCount === 1 ? "set" : "sets"}`
      : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <div className="px-11 text-center">
          <p className="flex items-center justify-center gap-1.5">
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
            <span className="truncate text-lg font-semibold tracking-tight">
              {name}
            </span>
          </p>
          {(position || status) && (
            <p className="tnum mt-1 text-[13px] text-muted">
              {[position, status].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        {!preview && overflow ? (
          <div data-no-pager="" className="absolute top-0 right-0">
            {overflow}
          </div>
        ) : null}
      </div>

      {notes ? <div className="text-left">{notes}</div> : null}

      {isSwapping && (
        <div>
          <ExerciseCombobox
            label="Replace with…"
            excludeIds={excludeSwapIds}
            placeholder="Search exercises"
            onCancel={onCancelSwap}
            onPick={onSwapPick}
          />
        </div>
      )}

      {preview && previewSet ? (
        <p className="flex min-h-11 items-center justify-center">
          <span className="tnum text-3xl font-semibold tracking-tight">
            {previewSet}
          </span>
        </p>
      ) : null}

      {children}
    </div>
  );
}
