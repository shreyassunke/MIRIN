import { useMemo } from "react";
import type { SetLog } from "../../db/db";
import {
  loggingLine,
  recommendNextSet,
  repRangeFor,
  stageMatchesRecommendation,
} from "../../lib/overload";
import { stageTotal, type StageDraft } from "../../lib/stageDraft";
import { type Unit } from "../../lib/units";
import { defaultRepsFor } from "../../lib/workout";

interface OverloadPanelProps {
  draft: StageDraft;
  /** Today's logs for this exercise, warm-ups included. */
  todayLogs: SetLog[];
  /** Last session's sets for this exercise. */
  prior: SetLog[];
  unit: Unit;
  /** The stage's own gloss, when the number has one — "both sides", "per hand". */
  qualifier?: string;
  dayTemplateId: string | null;
}

/**
 * One sentence under Log. The prescription is already on the stage; this line
 * only says why, or names both numbers once the lifter has moved off it.
 */
export function OverloadPanel({
  draft,
  todayLogs,
  prior,
  unit,
  qualifier,
  dayTemplateId,
}: OverloadPanelProps) {
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

  if (draft.loggingWarmup) return null;

  const range = recommendation?.range ?? repRangeFor(prior, fallbackReps);
  const weight = stageTotal(draft);
  const line = loggingLine({
    recommendation,
    weight,
    reps: draft.reps,
    unit,
    qualifier,
    onStage:
      recommendation != null &&
      stageMatchesRecommendation(weight, draft.reps, recommendation, draft.mode),
    range,
  });

  return <p className="text-[15px] leading-snug text-ink">{line}</p>;
}
