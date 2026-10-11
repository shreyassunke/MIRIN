import { exerciseCatalog, muscleCatalog, thresholds } from "./data";

export interface RecruitmentInput {
  muscleId: string;
  exerciseId: string;
  /** Approximate fraction of 1RM, from the set's weight and Epley estimate. */
  relativeLoad: number;
  /**
   * 0-based index of the rep being evaluated. 0 is rep one, the rep the
   * "under load from rep one" stat reads.
   */
  repIndex: number;
  /** Reps still available after this one. 0 means this rep is maximal. */
  repsInReserve: number;
  /**
   * Share of the lift this head takes, when the caller already knows it.
   * Omitted values still come from the exercise catalog.
   */
  involvement?: number;
}

/** Share of each fiber type that is on, from 0 to 1. Not a share of the pool. */
export interface FiberRecruitment {
  I: number;
  IIa: number;
  IIx: number;
}

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

const unit = (value: number) =>
  Number.isFinite(value) ? clamp(value, 0, 1) : 0;

function involvementFor(input: RecruitmentInput): number {
  if (input.involvement != null) return unit(input.involvement);
  const exercise = exerciseCatalog.find((row) => row.exerciseId === input.exerciseId);
  const match = exercise?.muscles.find((row) => row.muscleId === input.muscleId);
  return unit(match?.involvement ?? 0);
}

/**
 * How far this rep has climbed from the opening load toward the involvement
 * cap. Rep one with any reserve left adds nothing. A maximal rep (no reps
 * left, including a first-rep max) uses the whole cap. The shape is a model
 * choice, not a cited constant; the thresholds and ratios live in the JSON.
 */
function fatigue(repIndex: number, repsInReserve: number): number {
  if (!Number.isFinite(repIndex) || !Number.isFinite(repsInReserve)) return 0;
  const reps = Math.max(0, repIndex);
  const reserve = Math.max(0, repsInReserve);
  const span = reps + reserve;
  if (span <= 0) return 1;
  return reps / span;
}

/**
 * Size principle. Effective effort fills Type I across the band up to the
 * IIa threshold, then IIa up to the IIx threshold, then IIx up to 1.
 * Involvement caps the effort, so fatigue cannot recruit past the share of
 * the lift this head actually takes.
 */
export function effectiveEffort(input: RecruitmentInput): number {
  const load = unit(input.relativeLoad);
  const cap = involvementFor(input);
  const seen = load * cap;
  return unit(seen + (cap - seen) * fatigue(input.repIndex, input.repsInReserve));
}

function band(effort: number, start: number, end: number): number {
  if (!Number.isFinite(effort) || !Number.isFinite(start) || !Number.isFinite(end)) {
    return 0;
  }
  if (effort <= start) return 0;
  if (end <= start || effort >= end) return 1;
  return clamp((effort - start) / (end - start), 0, 1);
}

export function computeRecruitment(input: RecruitmentInput): FiberRecruitment {
  const effort = effectiveEffort(input);
  return {
    I: band(effort, thresholds.I, thresholds.IIa),
    IIa: band(effort, thresholds.IIa, thresholds.IIx),
    IIx: band(effort, thresholds.IIx, 1),
  };
}

/** Share of this muscle's pool that is on. Weights each type by its ratio. */
export function poolUnderLoad(
  muscleId: string,
  recruited: FiberRecruitment,
): number {
  const muscle = muscleCatalog.find((row) => row.id === muscleId);
  if (!muscle) return 0;
  const ratio = muscle.fiberTypeRatio;
  const share =
    unit(recruited.I) * unit(ratio.I) +
    unit(recruited.IIa) * unit(ratio.IIa) +
    unit(recruited.IIx) * unit(ratio.IIx);
  return Number.isFinite(share) ? clamp(share, 0, 1) : 0;
}

/**
 * Pool share working on rep one.
 *
 * Stage is the logging draft: the weight and reps currently on the card,
 * before Take is pressed. It is not the last logged set and not the previous
 * session. `% under load from rep one` is this share for the recommended
 * set, shown as a percent. The comparison against the draft is
 * `changeVsStage`.
 */
export function openingPoolShare(
  input: Omit<RecruitmentInput, "repIndex">,
): number {
  return poolUnderLoad(
    input.muscleId,
    computeRecruitment({ ...input, repIndex: 0 }),
  );
}

/**
 * Percentage points between two opening-rep pool shares.
 * Positive means the next set puts more of the pool under load from rep one
 * than the stage does (`up 19 from the stage`).
 */
export function changeVsStage(nextShare: number, stageShare: number): number {
  return Math.round(unit(nextShare) * 100) - Math.round(unit(stageShare) * 100);
}
