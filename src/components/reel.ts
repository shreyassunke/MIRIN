/** One detent of the log-pill reel. Finger up raises the value. */
export const REEL_STEP_PX = 36;

/** One detent of the docked figures. Finger up raises the value. */
export const FIGURE_REEL_STEP_PX = 56;

/** Asymptote near half a detent, matching the pager's edge resistance. */
export function rubberband(offset: number, dim: number) {
  if (dim <= 0) return 0;
  const limit = dim * 0.55;
  const x = Math.abs(offset);
  return Math.sign(offset) * (1 - 1 / (x / limit + 1)) * limit;
}

/**
 * Pixel travel since the last committed detent.
 * Positive remain is a finger moving down, which lowers the value.
 * Whole detents come back as steps. The leftover is the 1:1 offset,
 * pinched when the next detent does not exist.
 */
export function settleReel(
  remainPx: number,
  stepPx: number,
  stepValue: (direction: -1 | 1, value: number) => number,
  value: number,
): { steps: Array<-1 | 1>; offset: number } {
  let remain = remainPx;
  let current = value;
  const steps: Array<-1 | 1> = [];
  while (Math.abs(remain) >= stepPx) {
    const direction: -1 | 1 = remain > 0 ? -1 : 1;
    const next = stepValue(direction, current);
    if (next === current) break;
    steps.push(direction);
    current = next;
    remain += direction * stepPx;
  }
  const direction: -1 | 1 = remain > 0 ? -1 : 1;
  const blocked = remain !== 0 && stepValue(direction, current) === current;
  return {
    steps,
    offset: blocked ? rubberband(remain, stepPx) : remain,
  };
}

/** Release past halfway finishes the detent. Otherwise the digit returns. */
export function reelSnap(
  offset: number,
  stepPx: number,
  canCommit: (direction: -1 | 1) => boolean,
): { direction: -1 | 1 | 0; target: number } {
  if (Math.abs(offset) < stepPx / 2) return { direction: 0, target: 0 };
  const direction: -1 | 1 = offset > 0 ? -1 : 1;
  if (!canCommit(direction)) return { direction: 0, target: 0 };
  return { direction, target: Math.sign(offset) * stepPx };
}
