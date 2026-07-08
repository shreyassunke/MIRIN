import type { PointerEvent, ReactNode } from "react";
import type { Exercise, SetLog } from "../db/db";
import type { ExerciseLibraryEntry } from "../lib/library";
import { ExerciseCombobox } from "./ExerciseCombobox";
import { DragHandle } from "./DragHandle";

interface TodayExerciseTileProps {
  exercise: Exercise;
  logged: SetLog[];
  target: number;
  isActive: boolean;
  complete: boolean;
  lastSummary: string;
  isSwapping: boolean;
  excludeSwapIds: string[];
  reorderIndex: number;
  dragRowClassName: string;
  onDragHandlePointerDown?: (e: PointerEvent) => void;
  onDragHandlePointerMove?: (e: PointerEvent) => void;
  onDragHandlePointerUp?: (e: PointerEvent) => void;
  onDragHandlePointerCancel?: (e: PointerEvent) => void;
  onStartSwap: () => void;
  onCancelSwap: () => void;
  onSwapPick: (entry: ExerciseLibraryEntry) => void;
  formatLoggedSet: (log: SetLog) => string;
  children?: ReactNode;
}

export function TodayExerciseTile({
  exercise,
  logged,
  target,
  isActive,
  complete,
  lastSummary,
  isSwapping,
  excludeSwapIds,
  reorderIndex,
  dragRowClassName,
  onDragHandlePointerDown,
  onDragHandlePointerMove,
  onDragHandlePointerUp,
  onDragHandlePointerCancel,
  onStartSwap,
  onCancelSwap,
  onSwapPick,
  formatLoggedSet,
  children,
}: TodayExerciseTileProps) {
  return (
    <li
      data-reorder-index={reorderIndex}
      className={[
        "rounded-md border border-hairline bg-surface",
        dragRowClassName,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex items-stretch gap-2 px-2 py-2">
        <div className="flex shrink-0 items-center self-center">
          <DragHandle
            onPointerDown={onDragHandlePointerDown}
            onPointerMove={onDragHandlePointerMove}
            onPointerUp={onDragHandlePointerUp}
            onPointerCancel={onDragHandlePointerCancel}
          />
        </div>
        <button
          type="button"
          onClick={onStartSwap}
          className={[
            "flex min-w-0 flex-1 items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-left transition-colors duration-150 motion-reduce:transition-none",
            isActive ? "bg-surface-raised/50" : "hover:bg-surface-raised/30",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-expanded={isSwapping}
          aria-label={`Replace ${exercise.name}`}
        >
          <span className="min-w-0">
            <span className="block text-[17px] font-semibold tracking-tight">
              {exercise.name}
            </span>
            <span className="tnum mt-0.5 block text-[13px] text-muted">
              {lastSummary}
            </span>
          </span>
          <span className="tnum shrink-0 text-[13px] font-medium text-muted">
            {complete ? "Done" : `${logged.length} of ${target}`}
          </span>
        </button>
      </div>

      {isSwapping && (
        <div className="border-t border-hairline px-4 py-3">
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
        <div className="tnum flex flex-wrap gap-x-4 gap-y-1 border-t border-hairline px-4 py-2.5 text-sm text-muted">
          {logged.map((s) => (
            <span key={s.id} className="text-ink">
              {formatLoggedSet(s)}
            </span>
          ))}
        </div>
      )}

      {children}
    </li>
  );
}
