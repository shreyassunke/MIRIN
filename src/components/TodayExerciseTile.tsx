import {
  useRef,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from "react";
import type { Exercise, SetLog } from "../db/db";
import type { ExerciseLibraryEntry } from "../lib/library";
import { ExerciseCombobox } from "./ExerciseCombobox";

/** Second tap within this window = rename; first tap toggles immediately. */
const DOUBLE_TAP_MS = 260;

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
  dragStyle?: CSSProperties;
  onDragPointerDown?: (e: PointerEvent) => void;
  onDragPointerMove?: (e: PointerEvent) => void;
  onDragPointerUp?: (e: PointerEvent) => void;
  onDragPointerCancel?: (e: PointerEvent) => void;
  shouldSuppressClick?: () => boolean;
  onToggle: () => void;
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
  dragStyle,
  onDragPointerDown,
  onDragPointerMove,
  onDragPointerUp,
  onDragPointerCancel,
  shouldSuppressClick,
  onToggle,
  onStartSwap,
  onCancelSwap,
  onSwapPick,
  formatLoggedSet,
  children,
}: TodayExerciseTileProps) {
  const lastTapRef = useRef(0);

  function handleHeaderClick() {
    if (shouldSuppressClick?.()) return;

    const now = performance.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      lastTapRef.current = 0;
      onStartSwap();
      return;
    }

    lastTapRef.current = now;
    onToggle();
  }

  return (
    <li
      data-reorder-index={reorderIndex}
      style={dragStyle}
      onPointerDown={onDragPointerDown}
      onPointerMove={onDragPointerMove}
      onPointerUp={onDragPointerUp}
      onPointerCancel={onDragPointerCancel}
      className={["overflow-hidden rounded-xl glass select-none", dragRowClassName]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex items-stretch gap-2 px-2 py-2">
        <button
          type="button"
          data-drag-surface=""
          onClick={handleHeaderClick}
          className={[
            "glass-chip flex min-w-0 flex-1 items-baseline justify-between gap-3 rounded-md px-3 py-1.5 text-left select-none",
            isActive ? "glass-chip-active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-expanded={isActive}
          aria-label={
            isSwapping
              ? `Replace ${exercise.name}`
              : isActive
                ? `Collapse ${exercise.name}`
                : `Expand ${exercise.name}`
          }
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
