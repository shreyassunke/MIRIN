import { useMemo } from "react";
import type { Exercise, SetLog } from "../../db/db";
import { FiberStrands } from "../../features/anatomy/FiberStrands";
import {
  fiberRatio,
  headLabel,
  headShade,
  openingRecruitment,
  plateIdForRegion,
  primeInvolvement,
  useGroupPlate,
} from "../../features/anatomy/plate";
import { muscleSpec } from "../../lib/anatomy";
import { recruitmentFor } from "../../lib/fibers";
import { regionForExercise } from "../../lib/muscleRegions";
import { recommendNextSet, repRangeFor } from "../../lib/overload";
import { stageTotal, type StageDraft } from "../../lib/stageDraft";
import { type Unit } from "../../lib/units";
import { defaultRepsFor, formatWeight } from "../../lib/workout";
import { FiberLegend } from "./FiberField";

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
  const groupId = region ? plateIdForRegion(region) : null;
  const plate = useGroupPlate(groupId);
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
  const shade = headShade(groupId ?? "", exercise.id, exercise.name, region);
  const primeId = shade[0]?.muscleId ?? "";
  const slowShare = primeId ? fiberRatio(primeId).I : spec.slowShare;
  const range = recommendation?.range ?? repRangeFor(prior, fallbackReps);
  const e1rm = recommendation?.e1rm ?? 0;

  const stageWeight = stageTotal(draft);
  const stage = recruitmentFor({
    weight: stageWeight,
    reps: draft.reps,
    e1rm,
    slowShare,
    repMax: range.max,
  });
  const target = recommendation
    ? recruitmentFor({
        weight: recommendation.weight,
        reps: recommendation.reps,
        e1rm,
        slowShare,
        repMax: range.max,
      })
    : stage;

  const reading = recommendation ? target : stage;
  const onStage =
    recommendation != null &&
    recommendation.weight === stageWeight &&
    recommendation.reps === draft.reps;

  const shadeMap = Object.fromEntries(shade.map((head) => [head.muscleId, head.weight]));
  const headRatios = Object.fromEntries(shade.map((head) => [head.muscleId, fiberRatio(head.muscleId)]));
  const involvement = primeId ? primeInvolvement(exercise.id, primeId) : 0.8;
  const strandStage = openingRecruitment({
    muscleId: primeId,
    exerciseId: exercise.id,
    weight: stageWeight,
    reps: draft.reps,
    e1rm,
    repMax: range.max,
    involvement,
  });
  const strandTarget = recommendation
    ? openingRecruitment({
        muscleId: primeId,
        exerciseId: exercise.id,
        weight: recommendation.weight,
        reps: recommendation.reps,
        e1rm,
        repMax: range.max,
        involvement,
      })
    : strandStage;

  const lead = primeId ? headLabel(primeId) : spec.label;
  const anatomy = shade.length > 1 ? `${spec.label} · ${lead}` : spec.label;
  const prescription = recommendation ? (
    <>
      {formatWeight(recommendation.weight)}
      <span className="ml-1.5 text-[13px] font-medium text-muted">{unit}</span>
      <span className="mx-1.5 text-[13px] font-medium text-muted">×</span>
      {recommendation.reps}
    </>
  ) : (
    <>
      {range.min}–{range.max}
      <span className="ml-1.5 text-[13px] font-medium text-muted">reps</span>
    </>
  );

  return (
    <section aria-label={`Next set for ${exercise.name}`}>
      {recommendation && !onStage ? (
        <button
          type="button"
          onClick={() => onTake(recommendation.weight, recommendation.reps)}
          className="flex min-h-11 w-full items-baseline justify-between gap-4 text-left"
        >
          <span className="tnum text-xl leading-none font-semibold tracking-tight text-ink">
            {prescription}
          </span>
          <span className="text-[13px] font-medium text-ink">Take</span>
        </button>
      ) : (
        <p className="tnum flex items-baseline text-xl leading-none font-semibold tracking-tight text-ink">
          {prescription}
        </p>
      )}

      <p className="mt-2 text-[13px] font-medium text-muted">{anatomy}</p>
      <p className="mt-1 max-w-[40rem] text-[15px] leading-snug text-ink">
        {recommendation?.reason ??
          `Log a set. The next target stays inside ${range.min}–${range.max}.`}
      </p>

      {plate ? (
        <div className="mt-6">
          <FiberStrands
            key={`${groupId}:${shade.map((head) => head.muscleId + head.weight).join(",")}:${recommendation?.weight ?? stageWeight}:${recommendation?.reps ?? draft.reps}`}
            muscleId={groupId ?? spec.label}
            outline={plate.outline}
            viewBox={plate.viewBox}
            heads={plate.heads}
            shade={shadeMap}
            ratio={fiberRatio(primeId)}
            headRatios={headRatios}
            stage={strandStage}
            recruitment={strandTarget}
            label={`${anatomy}. ${percent(reading.onset)} percent under load from the first rep.`}
          />
        </div>
      ) : null}

      <p className="mt-4 text-[13px] leading-snug">
        <span className="tnum font-medium text-ink">{percent(reading.onset)}%</span>
        <span className="text-muted"> under load from the first rep</span>
      </p>
      <FiberLegend deepest={reading.deepest} />
    </section>
  );
}
