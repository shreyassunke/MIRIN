/**
 * Calendar-anchored split rotation. A split's `dayTemplateIds` is an ordered
 * loop of any length; each calendar day advances one position. The anchor
 * pins a known date to a known position, so the rotation is a pure function
 * of the date — it resumes correctly no matter how long the app was closed.
 *
 * Dependency-free on purpose: `scripts/verify-rotation-parity.mjs` imports
 * this file directly under node --experimental-strip-types.
 */

export interface RotationSplit {
  dayTemplateIds: string[];
  /** Local calendar date (YYYY-MM-DD) pinned to `anchorIndex`. */
  anchorDate?: string;
  anchorIndex?: number;
}

/**
 * The default seeded split is anchored to a Monday so its 7-slot rotation
 * [push, pull, legs, arms, chest-back, rest, rest] lands Push on Monday and
 * rest on weekends — identical to the original weekday schedule.
 */
export const DEFAULT_ANCHOR_DATE = "2024-01-01"; // a Monday
export const WEEKDAY_SHORT = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

const MS_PER_DAY = 86_400_000;

export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toLocalISODate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const localMidnightMs = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** Whole days from the split's anchor date to `date` (DST-safe). */
function daysFromAnchor(split: RotationSplit, date: Date): number {
  const anchor = parseLocalDate(split.anchorDate ?? DEFAULT_ANCHOR_DATE);
  return Math.round((localMidnightMs(date) - anchor.getTime()) / MS_PER_DAY);
}

/** Rotation position for a calendar date, or null for an empty split. */
export function rotationIndexForDate(
  split: RotationSplit,
  date: Date = new Date(),
): number | null {
  const len = split.dayTemplateIds.length;
  if (len === 0) return null;
  const raw = (split.anchorIndex ?? 0) + daysFromAnchor(split, date);
  return ((raw % len) + len) % len;
}

/** Day template id scheduled for a calendar date (may be a rest template). */
export function dayTemplateIdForDate(
  split: RotationSplit,
  date: Date = new Date(),
): string | null {
  const index = rotationIndexForDate(split, date);
  return index === null ? null : split.dayTemplateIds[index];
}

/**
 * Weekday label for each rotation position, only meaningful when the
 * rotation repeats weekly (length divisible by 7). Null otherwise.
 */
export function weekdayLabels(split: RotationSplit): string[] | null {
  const len = split.dayTemplateIds.length;
  if (len === 0 || len % 7 !== 0) return null;
  const anchor = parseLocalDate(split.anchorDate ?? DEFAULT_ANCHOR_DATE);
  const anchorWeekday = anchor.getDay();
  const anchorIndex = split.anchorIndex ?? 0;
  return split.dayTemplateIds.map(
    (_, i) => WEEKDAY_SHORT[(((anchorWeekday + i - anchorIndex) % 7) + 7) % 7],
  );
}

export interface UpcomingWorkout {
  dayTemplateId: string;
  /** 0 = today, 1 = tomorrow, ... */
  daysAway: number;
}

/**
 * The next non-rest day in the rotation starting from `date`, walking at
 * most one full loop. Null when every slot is a rest day.
 */
export function nextWorkout(
  split: RotationSplit,
  isRest: (dayTemplateId: string) => boolean,
  date: Date = new Date(),
  startOffset = 0,
): UpcomingWorkout | null {
  const len = split.dayTemplateIds.length;
  if (len === 0) return null;
  const todayIndex = rotationIndexForDate(split, date);
  if (todayIndex === null) return null;
  for (let offset = startOffset; offset < startOffset + len; offset++) {
    const id = split.dayTemplateIds[(todayIndex + offset) % len];
    if (!isRest(id)) return { dayTemplateId: id, daysAway: offset };
  }
  return null;
}
