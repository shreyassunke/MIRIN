import { useState } from "react";
import type { SetLog } from "../db/db";
import { updateSetLog } from "../lib/history";
import { MANUAL_STEP, toCanonical, toDisplay, type Unit } from "../lib/units";
import { formatWeight } from "../lib/workout";
import { Stepper } from "./Stepper";

interface LoggedSetGhostProps {
  set: SetLog;
  unit: Unit;
  onUndo: () => void;
}

/**
 * The set just logged, faded, sitting above the live log row.
 * Undo removes it. Edit corrects the weight or the reps in place.
 */
export function LoggedSetGhost({ set, unit, onUndo }: LoggedSetGhostProps) {
  const [editing, setEditing] = useState(false);
  const weight = toDisplay(set.weight, unit);

  return (
    <div className="logged-ghost">
      {editing ? (
        <>
          <Stepper
            layout="inline"
            size="compact"
            inlineSuffix={unit}
            label={`Logged weight (${unit})`}
            value={weight}
            step={MANUAL_STEP[unit]}
            min={0}
            onChange={(value) =>
              void updateSetLog(set.id, { weight: toCanonical(value, unit) })
            }
          />
          <span className="logged-ghost-times" aria-hidden="true">
            ×
          </span>
          <Stepper
            layout="inline"
            size="compact"
            inlineSuffix="reps"
            label="Logged reps"
            value={set.reps}
            step={1}
            min={1}
            onChange={(value) => void updateSetLog(set.id, { reps: value })}
          />
          <button
            type="button"
            className="logged-ghost-action"
            onClick={() => setEditing(false)}
          >
            Done
          </button>
        </>
      ) : (
        <>
          {set.isWarmup ? (
            <span className="logged-ghost-tag">Warm-up</span>
          ) : null}
          <p className="logged-ghost-figure tnum">
            <span>{formatWeight(weight)}</span>
            <span className="logged-ghost-unit">{unit}</span>
            <span className="logged-ghost-times" aria-hidden="true">
              ×
            </span>
            <span>{set.reps}</span>
          </p>
          <button type="button" className="logged-ghost-action" onClick={onUndo}>
            Undo
          </button>
          <button
            type="button"
            className="logged-ghost-action"
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
        </>
      )}
    </div>
  );
}
