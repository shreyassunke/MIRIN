import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SetLog } from "../db/db";
import { deleteSetDrop, deleteSetLog, updateSetDrop, updateSetLog } from "../lib/history";
import { MANUAL_STEP, toCanonical, toDisplay, type Unit } from "../lib/units";
import { Stepper } from "./Stepper";

interface LoggedSetsProps {
  sets: SetLog[];
  unit: Unit;
}

/** How far each row sits from the selection band, in row-heights. */
function placeWheel(node: HTMLUListElement) {
  const mid = node.scrollTop + node.clientHeight / 2;
  node.querySelectorAll<HTMLElement>(".logbook-row").forEach((row) => {
    const rowMid = row.offsetTop + row.offsetHeight / 2;
    const distance = row.offsetHeight > 0 ? (rowMid - mid) / row.offsetHeight : 0;
    row.style.setProperty("--wheel", distance.toFixed(3));
  });
}

/**
 * The sets logged on this exercise, as a wheel. The row in the band is the
 * one in hand; the others fall off above and below it. Drag a number to step
 * it, tap it to type. Minus removes that line.
 */
export function LoggedSets({ sets, unit }: LoggedSetsProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const tail = sets[sets.length - 1]?.id;
  const dropTail = sets[sets.length - 1]?.drops?.length ?? 0;

  useLayoutEffect(() => {
    const node = listRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
    placeWheel(node);
  }, [sets.length, tail, dropTail]);

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => placeWheel(node));
    };
    node.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(onScroll);
    observer.observe(node);
    return () => {
      cancelAnimationFrame(frame);
      node.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
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
  return (
    <div className="logbook-wheel">
      <div className="logbook-band" aria-hidden="true" />
      <ul ref={listRef} className="logbook" aria-label="Logged sets">
      <li className="logbook-pad" aria-hidden="true" />
      {lines.map((line) => {
        const drop = line.dropIndex >= 0 ? line.set.drops?.[line.dropIndex] : undefined;
        return (
          <li
            key={line.key}
            className="logbook-row"
            style={{ ["--wheel" as string]: "0" }}
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
      <li className="logbook-pad" aria-hidden="true" />
      </ul>
    </div>
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
