import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SetLog } from "../db/db";
import { deleteSetDrop, deleteSetLog, updateSetDrop, updateSetLog } from "../lib/history";
import { MANUAL_STEP, toCanonical, toDisplay, type Unit } from "../lib/units";
import { Stepper } from "./Stepper";

interface LoggedSetsProps {
  sets: SetLog[];
  unit: Unit;
}

/**
 * The sets logged on this exercise, oldest at the top. The figures are the
 * record: drag a number to step it, tap it to type. Minus removes that line.
 */
export function LoggedSets({ sets, unit }: LoggedSetsProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const tail = sets[sets.length - 1]?.id;
  const dropTail = sets[sets.length - 1]?.drops?.length ?? 0;

  useLayoutEffect(() => {
    const node = listRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [sets.length, tail, dropTail]);

  if (sets.length === 0) return null;

  const lines = sets.flatMap((set) => [
    { key: set.id, set, dropIndex: -1 },
    ...(set.drops ?? []).map((_, dropIndex) => ({
      key: `${set.id}:drop:${dropIndex}`,
      set,
      dropIndex,
    })),
  ]);
  const last = lines.length - 1;

  return (
    <ul ref={listRef} className="logbook" aria-label="Logged sets">
      {lines.map((line, i) => {
        const drop = line.dropIndex >= 0 ? line.set.drops?.[line.dropIndex] : undefined;
        return (
          <li
            key={line.key}
            className="logbook-row"
            style={{ ["--log-depth" as string]: String(last - i) }}
          >
            {drop ? (
              <LogLine
                drop
                unit={unit}
                weight={drop.weight}
                reps={drop.reps}
                removeLabel={`Remove drop ${line.dropIndex + 1} from set ${line.set.setNumber}`}
                onWeight={(value) =>
                  void updateSetDrop(line.set.id, line.dropIndex, {
                    weight: toCanonical(value, unit),
                  })
                }
                onReps={(value) =>
                  void updateSetDrop(line.set.id, line.dropIndex, { reps: value })
                }
                onRemove={() => void deleteSetDrop(line.set.id, line.dropIndex)}
              />
            ) : (
              <LogLine
                index={line.set.setNumber}
                warmup={line.set.isWarmup}
                unit={unit}
                weight={line.set.weight}
                reps={line.set.reps}
                removeLabel={
                  line.set.isWarmup
                    ? `Remove warm-up set ${line.set.setNumber}`
                    : `Remove set ${line.set.setNumber}`
                }
                onWeight={(value) =>
                  void updateSetLog(line.set.id, { weight: toCanonical(value, unit) })
                }
                onReps={(value) => void updateSetLog(line.set.id, { reps: value })}
                onRemove={() => void deleteSetLog(line.set.id)}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function LogLine({
  index,
  warmup = false,
  drop = false,
  unit,
  weight,
  reps,
  removeLabel,
  onWeight,
  onReps,
  onRemove,
}: {
  index?: number;
  warmup?: boolean;
  drop?: boolean;
  unit: Unit;
  weight: number;
  reps: number;
  removeLabel: string;
  onWeight: (value: number) => void;
  onReps: (value: number) => void;
  onRemove: () => void;
}) {
  const canonical = toDisplay(weight, unit);
  const [shownWeight, setShownWeight] = useState(canonical);
  const [shownReps, setShownReps] = useState(reps);
  useEffect(() => setShownWeight(canonical), [canonical]);
  useEffect(() => setShownReps(reps), [reps]);

  return (
    <>
      <span className="logbook-index tnum" aria-hidden="true">
        {drop ? "·" : index}
      </span>
      <div className="logbook-figures">
        <Stepper
          layout="readout"
          size="compact"
          drag
          inlineSuffix={unit}
          suffixClassName="logbook-unit"
          label={
            warmup
              ? `Warm-up set ${index} weight (${unit})`
              : drop
                ? `Drop weight (${unit})`
                : `Set ${index} weight (${unit})`
          }
          value={shownWeight}
          step={MANUAL_STEP[unit]}
          min={0}
          onChange={(value) => {
            setShownWeight(value);
            onWeight(value);
          }}
        />
        <span className="set-times logbook-times" aria-hidden="true">
          ×
        </span>
        <Stepper
          layout="readout"
          size="compact"
          drag
          inlineSuffix="reps"
          suffixClassName="logbook-unit"
          label={
            warmup
              ? `Warm-up set ${index} reps`
              : drop
                ? "Drop reps"
                : `Set ${index} reps`
          }
          value={shownReps}
          step={1}
          min={1}
          onChange={(value) => {
            setShownReps(value);
            onReps(value);
          }}
        />
      </div>
      <button type="button" className="logbook-remove" aria-label={removeLabel} onClick={onRemove}>
        −
      </button>
    </>
  );
}
