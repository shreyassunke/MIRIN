/**
 * Sideways travel inside a drag that has already locked vertical.
 * A straight slide stays on weight. Drift past the dead zone steps reps.
 * Right raises the count. The mapping is from the pointer-down point, so
 * drifting back undoes the steps.
 */
export const CROSS_DEAD_PX = 28;
export const CROSS_STEP_PX = 56;
export const REP_MIN = 1;

/** Signed steps for horizontal travel. Inside the dead zone, zero. */
export function crossStepCount(
  travelPx: number,
  deadPx = CROSS_DEAD_PX,
  stepPx = CROSS_STEP_PX,
): number {
  if (!(stepPx > 0) || !Number.isFinite(travelPx)) return 0;
  const mag = Math.abs(travelPx);
  if (mag < deadPx) return 0;
  const sign = travelPx > 0 ? 1 : -1;
  return sign * Math.floor((mag - deadPx) / stepPx);
}

/** The rep word lights once sideways travel has left the dead zone. */
export function crossAxisEngaged(
  travelPx: number,
  deadPx = CROSS_DEAD_PX,
): boolean {
  return Number.isFinite(travelPx) && Math.abs(travelPx) >= deadPx;
}

/**
 * Walk from the steps already applied toward the steps the finger now maps to.
 * Stops when a step is refused, so a floor does not bank steps that never landed.
 * Returns the applied count.
 */
export function applyCrossTravel(
  travelPx: number,
  applied: number,
  commit: (direction: -1 | 1) => boolean,
  deadPx = CROSS_DEAD_PX,
  stepPx = CROSS_STEP_PX,
): number {
  const target = crossStepCount(travelPx, deadPx, stepPx);
  let next = applied;
  while (next !== target) {
    const dir = (target > next ? 1 : -1) as -1 | 1;
    if (!commit(dir)) break;
    next += dir;
  }
  return next;
}

/** Next rep count, or null when the step would not move. */
export function nextReps(
  current: number,
  direction: -1 | 1,
  min = REP_MIN,
): number | null {
  if (!Number.isFinite(current)) return null;
  const next = current + direction;
  if (next < min) return null;
  return next;
}
