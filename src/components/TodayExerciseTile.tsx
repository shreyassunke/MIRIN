import { type CSSProperties, type PointerEvent, type ReactNode } from "react";
import type { Exercise, SetLog } from "../db/db";
import type { ExerciseLibraryEntry } from "../lib/library";
import type { GroupPos } from "../lib/exerciseMeta";
import { ExerciseCombobox } from "./ExerciseCombobox";

interface TodayExerciseTileProps {
  exercise: Exercise;
  logged: SetLog[];
  isActive: boolean;
  /** The user called this exercise done; there is no fixed set target. */
  finished: boolean;
  lastSummary: string;
  isSwapping: boolean;
  excludeSwapIds: string[];
  reorderIndex: number;
  dragRowClassName: string;
  dragStyle?: CSSProperties;
  groupPos?: GroupPos;
  inSuperset?: boolean;
  overflow?: ReactNode;
  notes?: ReactNode;
  onDragPointerDown?: (e: PointerEvent) => void;
  onDragPointerMove?: (e: PointerEvent) => void;
  onDragPointerUp?: (e: PointerEvent) => void;
  onDragPointerCancel?: (e: PointerEvent) => void;
  shouldSuppressClick?: () => boolean;
  onToggle: () => void;
  onCancelSwap: () => void;
  onSwapPick: (entry: ExerciseLibraryEntry) => void;
  formatLoggedSet: (log: SetLog) => string;
  children?: ReactNode;
}

function groupRadius(pos: GroupPos): string {
  if (pos === "first") return "rounded-t-xl rounded-b-none";
  if (pos === "middle") return "rounded-none";
  if (pos === "last") return "rounded-b-xl rounded-t-none";
  return "rounded-xl";
}

export function TodayExerciseTile({
  exercise,
  logged,
  isActive,
  finished,
  lastSummary,
  isSwapping,
  excludeSwapIds,
  reorderIndex,
  dragRowClassName,
  dragStyle,
  groupPos = "solo",
  inSuperset = false,
  overflow,
  notes,
  onDragPointerDown,
  onDragPointerMove,
  onDragPointerUp,
  onDragPointerCancel,
  shouldSuppressClick,
  onToggle,
  onCancelSwap,
  onSwapPick,
  formatLoggedSet,
  children,
}: TodayExerciseTileProps) {
  return (
    <li
      data-reorder-index={reorderIndex}
      style={dragStyle}
      onPointerDown={onDragPointerDown}
      onPointerMove={onDragPointerMove}
      onPointerUp={onDragPointerUp}
      onPointerCancel={onDragPointerCancel}
      className={[
        isActive ? "overflow-visible glass select-none" : "overflow-hidden glass select-none",
        groupRadius(groupPos),
        groupPos === "middle" || groupPos === "last"
          ? "-mt-px"
          : reorderIndex > 0
            ? "mt-3"
            : "",
        dragRowClassName,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex items-stretch gap-1 px-2 py-2">
        <button
          type="button"
          data-drag-surface=""
          onClick={() => {
            if (shouldSuppressClick?.()) return;
            onToggle();
          }}
          className={[
            "glass-chip flex min-w-0 flex-1 items-baseline justify-between gap-3 rounded-md px-3 py-1.5 text-left select-none",
            isActive ? "glass-chip-active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-expanded={isActive}
          aria-label={
            isActive
              ? `Collapse ${exercise.name}`
              : `Expand ${exercise.name}`
          }
        >
          <span className="min-w-0">
            <span className="flex min-w-0 items-center gap-1.5">
              {inSuperset && (
                <span className="shrink-0 text-muted" aria-hidden="true">
                  <svg
                    viewBox="0 0 16 16"
                    className="h-3.5 w-3.5"
                    fill="none"
                  >
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
              <span className="block truncate text-[17px] font-semibold tracking-tight">
                {exercise.name}
              </span>
            </span>
            <span className="tnum mt-0.5 block text-[13px] text-muted">
              {lastSummary}
            </span>
          </span>
          <span className="tnum shrink-0 text-[13px] font-medium text-muted">
            {finished
              ? `Done · ${logged.filter((s) => !s.isWarmup).length}`
              : logged.length === 0
                ? "No sets"
                : `${logged.length} ${logged.length === 1 ? "set" : "sets"}`}
          </span>
        </button>
        {overflow}
      </div>

      {notes ? <div data-no-drag="" className="px-4 pb-2">{notes}</div> : null}

      {isSwapping && (
        <div data-no-drag="" className="border-t border-hairline px-4 py-3">
          <ExerciseCombobox
            label="Replace with…"
            excludeIds={excludeSwapIds}
            placeholder="Search exercises"
            onCancel={onCancelSwap}
            onPick={onSwapPick}
          />
        </div>
      )}

      {logged.length > 0 && (
        <div
          data-no-drag=""
          className="tnum flex flex-wrap gap-x-4 gap-y-1 border-t border-hairline px-4 py-2.5 text-sm text-muted"
        >
          {logged.map((s) => (
            <span key={s.id} className="text-ink">
              {formatLoggedSet(s)}
            </span>
          ))}
        </div>
      )}

      {children ? <div data-no-drag="">{children}</div> : null}
    </li>
  );
}
