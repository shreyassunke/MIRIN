import type { SetLog } from "../db/db";
import { workingSets } from "./exerciseMeta";
import {
  DUMBBELL_SIZES,
  MANUAL_STEP,
  PLATE_SIZES,
  round2,
  toDisplay,
  type InputMethod,
  type Unit,
} from "./units";
import { epley, formatWeight } from "./workout";

export interface RepRange {
  min: number;
  max: number;
}

/**
 * The next load the implement can actually make, in display units. A rack
 * steps to its neighbouring bell; a bar steps by two change plates.
 */
export function nextLoad(
  current: number,
  direction: 1 | -1,
  mode: InputMethod,
  unit: Unit,
): number {
  if (mode === "dumbbell") {
    const sizes = DUMBBELL_SIZES[unit];
    let at = 0;
    for (let i = 1; i < sizes.length; i++) {
      if (Math.abs(sizes[i] - current) < Math.abs(sizes[at] - current)) at = i;
    }
    return sizes[at + direction] ?? sizes[at];
  }
  const plates = PLATE_SIZES[unit];
  const step =
    mode === "barbell" ? 2 * plates[plates.length - 1] : MANUAL_STEP[unit];
  return round2(Math.max(0, current + direction * step));
}

/**
 * The band this lift is worked in. Its top is the best rep count the lift has
 * actually reached, never under the day's own rep intent, and the band runs
 * three reps below that. Double progression measures a session against a fixed
 * target, so the band must not be centred on the sets being judged.
 */
export function repRangeFor(prior: SetLog[], fallbackReps: number): RepRange {
  const reps = workingSets(prior)
    .map((set) => set.reps)
    .filter((count) => count > 0);
  const max = Math.max(fallbackReps, ...reps);
  return { min: Math.max(4, max - 3), max };
}

/** Best estimated 1RM across a set of logs, in display units. */
export function bestE1rm(logs: SetLog[], unit: Unit): number {
  let best = 0;
  for (const log of logs) {
    best = Math.max(best, epley(toDisplay(log.weight, unit), log.reps));
  }
  return best;
}

export type OverloadVerdict = "progress" | "hold" | "match" | "backoff";

export interface Recommendation {
  verdict: OverloadVerdict;
  /** Display units. */
  weight: number;
  reps: number;
  range: RepRange;
  /** Estimated 1RM the recruitment read is measured against, display units. */
  e1rm: number;
  /** The evidence behind the verdict, in logbook voice. */
  reason: string;
}

const list = (reps: number[]) => reps.join(", ");

/**
 * Double progression. Fill the rep range at a load, then take one equipment
 * step and start the range again. Mid-session the load holds and the target
 * is the set just logged; between sessions every working set is weighed.
 */
export function recommendNextSet(args: {
  /** Today's logs for this exercise, warm-ups included. */
  today: SetLog[];
  /** Last session's working sets for this exercise. */
  prior: SetLog[];
  mode: InputMethod;
  unit: Unit;
  fallbackReps: number;
}): Recommendation | null {
  const { mode, unit } = args;
  const logged = workingSets(args.today);
  const prior = workingSets(args.prior);
  if (logged.length === 0 && prior.length === 0) return null;

  const range = repRangeFor(prior.length > 0 ? prior : logged, args.fallbackReps);
  const e1rm = bestE1rm([...prior, ...logged], unit);

  if (logged.length > 0) {
    const reference = logged[logged.length - 1];
    const weight = toDisplay(reference.weight, unit);
    const reps = logged.map((set) => set.reps);
    if (reference.reps > range.max) {
      return {
        verdict: "progress",
        weight: nextLoad(weight, 1, mode, unit),
        reps: range.min,
        range,
        e1rm,
        reason: `Today: ${list(reps)}. Past ${range.max} at ${formatWeight(weight)}.`,
      };
    }
    if (reference.reps < range.min) {
      return {
        verdict: "backoff",
        weight: nextLoad(weight, -1, mode, unit),
        reps: range.min,
        range,
        e1rm,
        reason: `Today: ${list(reps)}. Under ${range.min}.`,
      };
    }
    return {
      verdict: "match",
      weight,
      reps: reference.reps,
      range,
      e1rm,
      reason: `Today: ${list(reps)}. Hold the load and match it.`,
    };
  }

  const weight = Math.max(...prior.map((set) => toDisplay(set.weight, unit)));
  const reps = prior.map((set) => set.reps);
  const low = Math.min(...reps);
  const high = Math.max(...reps);

  if (low >= range.max) {
    return {
      verdict: "progress",
      weight: nextLoad(weight, 1, mode, unit),
      reps: range.min,
      range,
      e1rm,
      reason: `Last time: ${list(reps)}. ${
        reps.length > 1 ? "Every set reached" : "That reached"
      } ${range.max}.`,
    };
  }
  if (low < range.min) {
    return {
      verdict: "backoff",
      weight: nextLoad(weight, -1, mode, unit),
      reps: range.min,
      range,
      e1rm,
      reason: `Last time: ${list(reps)}. A set fell under ${range.min}.`,
    };
  }
  const target = Math.min(high + 1, range.max);
  return {
    verdict: "hold",
    weight,
    reps: target,
    range,
    e1rm,
    reason:
      target > high
        ? `Last time: ${list(reps)}. One more than ${high}.`
        : `Last time: ${list(reps)}. Bring every set to ${range.max}.`,
  };
}
