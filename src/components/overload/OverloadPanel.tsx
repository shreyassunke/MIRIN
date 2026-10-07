import { useMemo } from "react";
import type { Exercise, SetLog } from "../../db/db";
import { emphasisBundle, muscleSpec } from "../../lib/anatomy";
import { recruitmentFor } from "../../lib/fibers";
import { regionForExercise } from "../../lib/muscleRegions";
import { recommendNextSet, repRangeFor } from "../../lib/overload";
import { stageTotal, type StageDraft } from "../../lib/stageDraft";
import { type Unit } from "../../lib/units";
import { defaultRepsFor, formatWeight } from "../../lib/workout";
import { FiberField, FiberLegend } from "./FiberField";

interface OverloadPanelProps {
  exercise: Exercise;
  draft: StageDraft;
  /** Today's logs for this exercise, warm-ups included. */
  todayLogs: SetLog[];
  /** Last session's sets for this exercise. */
  prior: SetLog[];
  unit: Unit;
  dayTemplateId: string | null;
  onTake: (weight: number, reps: number) => void;
}

const percent = (share: number) => Math.round(share * 100);

/**
 * What the next set should be, and which fibres it reaches that the numbers on
 * the stage do not. The prescription is double progression; the plate is the
 * targeted muscle's own fascicles, lit in recruitment order.
 */
export function OverloadPanel({
  exercise,
  draft,
  todayLogs,
  prior,
  unit,
  dayTemplateId,
  onTake,
}: OverloadPanelProps) {
  const region = regionForExercise(exercise);
  const fallbackReps = defaultRepsFor(dayTemplateId ?? "");

  const recommendation = useMemo(
    () =>
      recommendNextSet({
        today: todayLogs,
        prior,
        mode: draft.mode,
        unit,
        fallbackReps,
      }),
    [todayLogs, prior, draft.mode, unit, fallbackReps],
  );

  if (!region) return null;

  const spec = muscleSpec(region);
  const emphasis = emphasisBundle(region, exercise);
  const range = recommendation?.range ?? repRangeFor(prior, fallbackReps);
  const e1rm = recommendation?.e1rm ?? 0;

  const stageWeight = stageTotal(draft);
  const stage = recruitmentFor({
    weight: stageWeight,
    reps: draft.reps,
    e1rm,
    slowShare: spec.slowShare,
    repMax: range.max,
  });
  const target = recommendation
    ? recruitmentFor({
        weight: recommendation.weight,
        reps: recommendation.reps,
        e1rm,
        slowShare: spec.slowShare,
        repMax: range.max,
      })
    : stage;

  const bundle = spec.bundles[emphasis].label;
  const reading = recommendation ? target : stage;
  const delta = percent(target.onset) - percent(stage.onset);
  const onStage =
    recommendation != null &&
    recommendation.weight === stageWeight &&
    recommendation.reps === draft.reps;

  const anatomy = `${spec.label} · ${bundle}`;
  const drift =
    !recommendation || onStage
      ? null
      : delta > 0
        ? `up ${delta} from the stage`
        : delta < 0
          ? `down ${-delta} from the stage`
          : "level with the stage";

  return (
    <section
      aria-label={`Progressive overload for ${exercise.name}`}
      className="glass rounded-xl p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[13px] font-medium text-muted">Next set</h2>
        {recommendation ? (
          <p className="tnum text-[20px] leading-none font-semibold text-ink">
            {formatWeight(recommendation.weight)}
            <span className="ml-1 text-[13px] font-medium text-muted">
              {unit}
            </span>
            <span className="mx-1.5 text-[13px] font-medium text-muted">×</span>
            {recommendation.reps}
          </p>
        ) : (
          <p className="tnum text-[13px] font-medium text-muted">
            {range.min}–{range.max} reps
          </p>
        )}
      </div>

      <p className="mt-1 text-[13px] leading-relaxed text-muted">
        {recommendation?.reason ??
          `Log a set and the next one gets a target in the ${range.min}–${range.max} band.`}
      </p>

      <div className="mt-3">
        <FiberField
          region={region}
          emphasis={emphasis}
          // With no history there is nothing to have gained, so the plate
          // simply reads the stage rather than sweeping every fibre alight.
          stageOnset={recommendation ? stage.onset : reading.onset}
          onset={reading.onset}
          ceiling={reading.ceiling}
          runKey={`${exercise.id}:${recommendation?.weight ?? stageWeight}:${recommendation?.reps ?? draft.reps}:${percent(stage.onset)}`}
          label={`${spec.label}, ${bundle} fibres. ${percent(reading.onset)} percent of the pool under load from the opening rep, reaching ${reading.touched ? `type ${reading.touched}` : "nothing"} by the last.`}
        />
      </div>

      {/* Keyed to the opening rep, not the last: that is the half overload moves. */}
      <FiberLegend deepest={reading.deepest} />

      <p className="mt-2 text-[13px] leading-relaxed">
        <span className="tnum font-medium text-ink">
          {percent(reading.onset)}% under load from rep one
        </span>
        {drift && <span className="text-muted">, {drift}</span>}
      </p>
      <p className="text-[13px] leading-relaxed text-muted">{anatomy}</p>

      {recommendation && !onStage && (
        <button
          type="button"
          onClick={() => onTake(recommendation.weight, recommendation.reps)}
          className="glass-btn mt-4 h-12 w-full rounded-pill text-[15px] font-medium text-ink"
        >
          Take {formatWeight(recommendation.weight)}×{recommendation.reps}
        </button>
      )}
    </section>
  );
}
