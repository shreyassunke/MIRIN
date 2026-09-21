import { type CSSProperties, type PointerEvent, type ReactNode, type Ref } from "react";
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
  onUndoLast?: () => void;
  undoLastHasDrop?: boolean;
  children?: ReactNode;
  /** Horizontal pager field for equipment modes. */
  swipeFieldRef?: Ref<HTMLDivElement>;
  /** Shown in place of the stored name while an implement is selected. */
  title?: string;
}

function rowSpacing(reorderIndex: number, groupPos: GroupPos): string {
  if (reorderIndex === 0) return "";
  if (groupPos === "middle" || groupPos === "last") return "";
  return "mt-1";
}

export function TodayExerciseTile({
  exercise,
  logged,
  isActive,
  finished,
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
  onUndoLast,
  undoLastHasDrop = false,
  children,
  swipeFieldRef,
  title,
}: TodayExerciseTileProps) {
  const name = title ?? exercise.name;
  return (
    <li
      data-reorder-index={reorderIndex}
      style={dragStyle}
      onPointerDown={onDragPointerDown}
      onPointerMove={onDragPointerMove}
      onPointerUp={onDragPointerUp}
      onPointerCancel={onDragPointerCancel}
      className={[
        "select-none",
        isActive ? "overflow-visible" : "overflow-hidden",
        rowSpacing(reorderIndex, groupPos),
        dragRowClassName,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        ref={swipeFieldRef}
        className={swipeFieldRef ? "load-swipe-field" : undefined}
      >
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          data-drag-surface=""
          onPointerDown={(e) => {
            e.currentTarget.classList.add("is-pressed");
          }}
          onPointerUp={(e) => {
            e.currentTarget.classList.remove("is-pressed");
          }}
          onPointerCancel={(e) => {
            e.currentTarget.classList.remove("is-pressed");
          }}
          onPointerLeave={(e) => {
            e.currentTarget.classList.remove("is-pressed");
          }}
          onClick={() => {
            if (shouldSuppressClick?.()) return;
            onToggle();
          }}
          className="exercise-row-hit flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-between gap-3 py-1.5 text-left select-none"
          aria-expanded={isActive}
          aria-label={isActive ? `Collapse ${name}` : `Expand ${name}`}
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
              <span className="block truncate text-lg font-semibold tracking-tight">
                {name}
              </span>
            </span>
          </span>
          <span className="exercise-row-meta tnum shrink-0 text-[13px] font-medium">
            {finished
              ? `Done · ${logged.filter((s) => !s.isWarmup).length}`
              : logged.length === 0
                ? "No sets"
                : `${logged.length} ${logged.length === 1 ? "set" : "sets"}`}
          </span>
        </button>
        {overflow}
      </div>

      {notes ? (
        <div data-no-drag="" className="pb-2">
          {notes}
        </div>
      ) : null}

      {isSwapping && (
        <div data-no-drag="" className="py-3">
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
          data-no-pager=""
          className="tnum flex flex-wrap items-center gap-x-4 gap-y-1 py-1.5 text-sm text-muted"
        >
          {logged.map((s, i) => {
            const isLast = i === logged.length - 1;
            if (isLast && onUndoLast) {
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
        </div>
      )}

      {children ? <div data-no-drag="">{children}</div> : null}
      </div>
    </li>
  );
}
