import { type ReactNode } from "react";
import type { Exercise, SetLog } from "../db/db";

interface LoggedSetLedgerProps {
  logs: SetLog[];
  formatSet: (log: SetLog) => string;
  onUndoLast: () => void;
  /** The last logged action was a drop on the current set. */
  undoLastHasDrop?: boolean;
}

/**
 * Sets already logged for the exercise in front. Earlier sets are quiet
 * figures; the latest stays bright, with undo on the last action.
 */
export function LoggedSetLedger({
  logs,
  formatSet,
  onUndoLast,
  undoLastHasDrop = false,
}: LoggedSetLedgerProps) {
  if (logs.length === 0) return null;
  const last = logs[logs.length - 1]!;
  const lastLabel = formatSet(last);
  const undoWord = undoLastHasDrop ? "Undo drop" : "Undo";

  return (
    <div className="set-ledger tnum" role="group" aria-label="Logged sets">
      {logs.slice(0, -1).map((set) => (
        <span key={set.id} className="set-ledger-item">
          {formatSet(set)}
        </span>
      ))}
      <button
        type="button"
        className="set-ledger-undo"
        onClick={onUndoLast}
        aria-label={
          undoLastHasDrop
            ? `Undo last drop on ${lastLabel}`
            : `Undo ${lastLabel}`
        }
      >
        <span key={`${last.id}:${lastLabel}`} className="set-ledger-latest fade-in" aria-hidden="true">
          {lastLabel}
        </span>
        <span className="set-ledger-undo-word">{undoWord}</span>
      </button>
    </div>
  );
}

interface TodayExercisePageProps {
  exercise: Exercise;
  logged: SetLog[];
  finished: boolean;
  inSuperset?: boolean;
  overflow?: ReactNode;
  children?: ReactNode;
  title?: string;
}

export function TodayExercisePage({
  exercise,
  logged,
  finished,
  inSuperset = false,
  overflow,
  children,
  title,
}: TodayExercisePageProps) {
  const name = title ?? exercise.name;
  const workingCount = logged.filter((set) => !set.isWarmup).length;
  const status = finished
    ? `Done · ${workingCount}`
    : workingCount > 0
      ? `${workingCount} ${workingCount === 1 ? "set" : "sets"}`
      : null;

  return (
    <div className="flex flex-col gap-4" data-exercise-stage="">
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
          {status ? (
            <p className="tnum mt-1 text-[13px] text-muted">{status}</p>
          ) : null}
        </div>
        {overflow ? (
          <div data-no-pager="" className="absolute top-0 right-0">
            {overflow}
          </div>
        ) : null}
      </div>

      {children}
    </div>
  );
}
