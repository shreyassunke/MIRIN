import { type ReactNode } from "react";
import type { Exercise, SetLog } from "../db/db";
import type { ExerciseLibraryEntry } from "../lib/library";
import { ExerciseCombobox } from "./ExerciseCombobox";

interface TodayExercisePageProps {
  exercise: Exercise;
  logged: SetLog[];
  pending: SetLog[];
  finished: boolean;
  isSwapping: boolean;
  excludeSwapIds: string[];
  inSuperset?: boolean;
  overflow?: ReactNode;
  notes?: ReactNode;
  onCancelSwap: () => void;
  onSwapPick: (entry: ExerciseLibraryEntry) => void;
  formatLoggedSet: (log: SetLog) => string;
  onUndoLast?: () => void;
  undoLastHasDrop?: boolean;
  onStampNext?: () => void;
  children?: ReactNode;
  title?: string;
  position?: string;
  /** Neighbor page during a swipe — name, chips, and the next set only. */
  preview?: boolean;
  previewSet?: string;
}

export function TodayExercisePage({
  exercise,
  logged,
  pending,
  finished,
  isSwapping,
  excludeSwapIds,
  inSuperset = false,
  overflow,
  notes,
  onCancelSwap,
  onSwapPick,
  formatLoggedSet,
  onUndoLast,
  undoLastHasDrop = false,
  onStampNext,
  children,
  title,
  position,
  preview = false,
  previewSet,
}: TodayExercisePageProps) {
  const name = title ?? exercise.name;
  const workingCount = logged.filter((s) => !s.isWarmup).length;
  const showChips = logged.length > 0 || pending.length > 0;
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

      {notes ? (
        <div data-no-pager="" className="text-left">
          {notes}
        </div>
      ) : null}

      {isSwapping && (
        <div data-no-pager="">
          <ExerciseCombobox
            label="Replace with…"
            excludeIds={excludeSwapIds}
            placeholder="Search exercises"
            onCancel={onCancelSwap}
            onPick={onSwapPick}
          />
        </div>
      )}

      {showChips && (
        <div
          data-no-pager=""
          className="tnum flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-muted"
        >
          {logged.map((s, i) => {
            const isLast = i === logged.length - 1;
            if (isLast && onUndoLast && !preview) {
              const label = formatLoggedSet(s);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={onUndoLast}
                  aria-label={
                    undoLastHasDrop
                      ? `Undo last drop on ${label}`
                      : `Undo ${label}`
                  }
                  className="glass-chip inline-flex h-8 items-center gap-1.5 rounded-pill px-2.5 text-ink"
                >
                  <span>{label}</span>
                  <span className="text-[13px] font-medium text-muted">
                    Undo
                  </span>
                </button>
              );
            }
            return (
              <span key={s.id} className="text-ink">
                {formatLoggedSet(s)}
              </span>
            );
          })}
          {pending.map((s, i) => {
            const label = formatLoggedSet(s);
            if (i === 0 && onStampNext && !preview) {
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={onStampNext}
                  aria-label={`Log ${label} from last session`}
                  className="glass-chip inline-flex h-8 items-center rounded-pill px-2.5 text-ink"
                >
                  {label}
                </button>
              );
            }
            return <span key={s.id}>{label}</span>;
          })}
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
