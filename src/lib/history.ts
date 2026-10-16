import { db, type DayTemplate, type SetLog, type WorkoutSession } from "../db/db";
import { toLocalISODate } from "./rotation";
import { newId } from "./workout";
import { toCanonical, type Unit } from "./units";

export interface DaySessionSummary {
  session: WorkoutSession;
  dayName: string;
  setCount: number;
  exerciseCount: number;
}

/** Local calendar date (YYYY-MM-DD) for a session's stored ISO datetime. */
export function sessionDateKey(session: WorkoutSession): string {
  return toLocalISODate(new Date(session.date));
}

/** Build a 6×7 month grid of local dates (leading/trailing padding included). */
export function monthCells(year: number, monthIndex: number): Date[] {
  const first = new Date(year, monthIndex, 1);
  const startOffset = first.getDay(); // Sun = 0
  const start = new Date(year, monthIndex, 1 - startOffset);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(d);
  }
  return cells;
}

export function shiftMonth(year: number, monthIndex: number, delta: number): {
  year: number;
  monthIndex: number;
} {
  const d = new Date(year, monthIndex + delta, 1);
  return { year: d.getFullYear(), monthIndex: d.getMonth() };
}

export function formatMonthLabel(year: number, monthIndex: number): string {
  return new Date(year, monthIndex, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

/** Compact "Sep 9" label for axis ticks and dense rows. */
export function shortDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function formatDayHeading(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function parseDateKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

/** Sunday of the local week that contains `date`. */
export function startOfWeek(date: Date): Date {
  return addDays(date, -date.getDay());
}

export function weekCells(anchor: Date): Date[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export const CONTRIBUTION_LEVELS = [0, 1, 2, 3, 4] as const;
export type ContributionLevel = (typeof CONTRIBUTION_LEVELS)[number];

/**
 * Sets logged on a day, or sets of one exercise when a target is in focus.
 * A day with no log is zero. Volume, not a streak.
 */
export function setsOnDay(
  day: TrainingDay | undefined,
  exerciseId: string | null,
): number {
  if (!day) return 0;
  if (!exerciseId) {
    return day.sessions.reduce((sum, session) => sum + session.setCount, 0);
  }
  let sets = 0;
  for (const session of day.sessions) {
    for (const exercise of session.exercises) {
      if (exercise.exerciseId === exerciseId) sets += exercise.sets;
    }
  }
  return sets;
}

/** Discrete heat. The same count is the same shade in every year. */
export function contributionLevel(sets: number): ContributionLevel {
  if (sets <= 0) return 0;
  if (sets < 5) return 1;
  if (sets < 10) return 2;
  if (sets < 16) return 3;
  return 4;
}

export interface ContributionDay {
  key: string;
  date: Date;
  /** Inside the selected range. Padding and days after today do not count. */
  counts: boolean;
}

export interface ContributionColumn {
  /** Sunday through Saturday. */
  days: ContributionDay[];
}

export interface ContributionMonth {
  label: string;
  column: number;
}

export interface ContributionCalendar {
  columns: ContributionColumn[];
  months: ContributionMonth[];
  startKey: string;
  endKey: string;
}

function atMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function monthShort(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short" });
}

/**
 * Sunday-aligned columns covering `gridStart`–`gridEnd`.
 * Only days from `countStart` through `countEnd` count toward the range.
 */
function buildContribution(
  gridStart: Date,
  gridEnd: Date,
  countStart: Date,
  countEnd: Date,
): ContributionCalendar {
  const startMs = countStart.getTime();
  const endMs = countEnd.getTime();
  const columns: ContributionColumn[] = [];
  for (
    let cursor = gridStart;
    cursor.getTime() <= gridEnd.getTime();
    cursor = addDays(cursor, 7)
  ) {
    const days: ContributionDay[] = [];
    for (let index = 0; index < 7; index++) {
      const date = addDays(cursor, index);
      const time = date.getTime();
      days.push({
        key: toLocalISODate(date),
        date,
        counts: time >= startMs && time <= endMs,
      });
    }
    columns.push({ days });
  }

  const months: ContributionMonth[] = [];
  columns.forEach((column, index) => {
    const opening = column.days.find((day) => day.counts);
    if (index === 0 && opening) {
      months.push({ label: monthShort(opening.date), column: 0 });
    }
    const firstOfMonth = column.days.find(
      (day) => day.counts && day.date.getDate() === 1,
    );
    if (!firstOfMonth || index === 0) return;
    const prev = months[months.length - 1];
    if (prev && index - prev.column < 2) return;
    months.push({ label: monthShort(firstOfMonth.date), column: index });
  });

  return {
    columns,
    months,
    startKey: toLocalISODate(countStart),
    endKey: toLocalISODate(countEnd),
  };
}

/** The rolling year ending today: GitHub's "last year", Sunday-aligned. */
export function trailingContribution(today: Date): ContributionCalendar {
  const end = atMidnight(today);
  const start = addDays(end, -364);
  return buildContribution(startOfWeek(start), addDays(startOfWeek(end), 6), start, end);
}

/** One calendar year. The current year stops at today. */
export function yearContribution(year: number, today: Date): ContributionCalendar {
  const endCap = atMidnight(today);
  const start = new Date(year, 0, 1);
  const last = new Date(year, 11, 31);
  const end = last.getTime() < endCap.getTime() ? last : endCap;
  return buildContribution(
    startOfWeek(start),
    addDays(startOfWeek(end), 6),
    start,
    end,
  );
}

/** Current year first, then back to the earliest logged day. */
export function contributionYears(dateKeys: Iterable<string>, today: Date): number[] {
  const current = today.getFullYear();
  let earliest = current;
  for (const key of dateKeys) {
    const year = Number(key.slice(0, 4));
    if (year >= 1970 && year < earliest) earliest = year;
  }
  const years: number[] = [];
  for (let year = current; year >= earliest; year--) years.push(year);
  return years;
}

/** "October 11–17", or a cross-month span when the week breaks. */
export function formatWeekLabel(start: Date, end: Date): string {
  const sameMonth =
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    const month = start.toLocaleDateString(undefined, { month: "long" });
    return `${month} ${start.getDate()}–${end.getDate()}`;
  }
  const left = start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const right = end.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  if (start.getFullYear() !== end.getFullYear()) {
    return `${left}, ${start.getFullYear()} – ${right}, ${end.getFullYear()}`;
  }
  return `${left} – ${right}`;
}

export interface TrainingExercise {
  exerciseId: string;
  best: number;
  sets: number;
}

export interface TrainingSession {
  session: WorkoutSession;
  dayName: string;
  setCount: number;
  exerciseCount: number;
  exercises: TrainingExercise[];
}

export interface TrainingDay {
  sessions: TrainingSession[];
  /** A completed session, or any logged set. */
  marked: boolean;
  bestByExercise: Map<string, number>;
}

/** Every session grouped onto its local calendar day, newest first. */
export function indexTrainingDays(
  sessions: WorkoutSession[],
  logs: SetLog[],
  templates: DayTemplate[],
): Map<string, TrainingDay> {
  const dayNames = new Map(templates.map((day) => [day.id, day.name] as const));
  const logsBySession = new Map<string, SetLog[]>();
  for (const log of logs) {
    const list = logsBySession.get(log.sessionId) ?? [];
    list.push(log);
    logsBySession.set(log.sessionId, list);
  }

  const byDate = new Map<string, TrainingDay>();
  const ordered = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  for (const session of ordered) {
    const key = sessionDateKey(session);
    const sessionLogs = logsBySession.get(session.id) ?? [];
    const byExercise = new Map<string, TrainingExercise>();
    for (const log of sessionLogs) {
      const prev = byExercise.get(log.exerciseId);
      if (prev) {
        prev.sets += 1;
        prev.best = Math.max(prev.best, log.weight);
      } else {
        byExercise.set(log.exerciseId, {
          exerciseId: log.exerciseId,
          best: log.weight,
          sets: 1,
        });
      }
    }

    const day = byDate.get(key) ?? {
      sessions: [],
      marked: false,
      bestByExercise: new Map<string, number>(),
    };
    day.marked = day.marked || session.completed || sessionLogs.length > 0;
    for (const exercise of byExercise.values()) {
      day.bestByExercise.set(
        exercise.exerciseId,
        Math.max(day.bestByExercise.get(exercise.exerciseId) ?? 0, exercise.best),
      );
    }
    day.sessions.push({
      session,
      dayName: dayNames.get(session.dayTemplateId) ?? "Session",
      setCount: sessionLogs.length,
      exerciseCount: byExercise.size,
      exercises: [...byExercise.values()],
    });
    byDate.set(key, day);
  }
  return byDate;
}

export function allTimeBests(logs: SetLog[]): Map<string, number> {
  const best = new Map<string, number>();
  for (const log of logs) {
    best.set(log.exerciseId, Math.max(best.get(log.exerciseId) ?? 0, log.weight));
  }
  return best;
}

/** Sessions that fall on a local calendar day, newest first. */
export async function sessionsForDate(
  dateKey: string,
): Promise<DaySessionSummary[]> {
  const [sessions, dayTemplates, logs] = await Promise.all([
    db.sessions.toArray(),
    db.dayTemplates.toArray(),
    db.setLogs.toArray(),
  ]);
  const dayNames = new Map(dayTemplates.map((d) => [d.id, d.name] as const));
  const logsBySession = new Map<string, SetLog[]>();
  for (const log of logs) {
    const list = logsBySession.get(log.sessionId) ?? [];
    list.push(log);
    logsBySession.set(log.sessionId, list);
  }

  return sessions
    .filter((s) => sessionDateKey(s) === dateKey)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((session) => {
      const sessionLogs = logsBySession.get(session.id) ?? [];
      const exerciseIds = new Set(sessionLogs.map((l) => l.exerciseId));
      return {
        session,
        dayName: dayNames.get(session.dayTemplateId) ?? "Session",
        setCount: sessionLogs.length,
        exerciseCount: exerciseIds.size,
      };
    });
}

/** Map of local date → sessions that have at least one set (or are completed). */
export async function sessionDatesInRange(
  startKey: string,
  endKey: string,
): Promise<Map<string, { count: number; completed: boolean }>> {
  const [sessions, logs] = await Promise.all([
    db.sessions.toArray(),
    db.setLogs.toArray(),
  ]);
  const setCounts = new Map<string, number>();
  for (const log of logs) {
    setCounts.set(log.sessionId, (setCounts.get(log.sessionId) ?? 0) + 1);
  }

  const result = new Map<string, { count: number; completed: boolean }>();
  for (const session of sessions) {
    const key = sessionDateKey(session);
    if (key < startKey || key > endKey) continue;
    const sets = setCounts.get(session.id) ?? 0;
    if (sets === 0 && !session.completed) continue;
    const prev = result.get(key);
    result.set(key, {
      count: (prev?.count ?? 0) + 1,
      completed: (prev?.completed ?? false) || session.completed || sets > 0,
    });
  }
  return result;
}

export async function updateSetLog(
  setId: string,
  patch: { weight?: number; reps?: number },
): Promise<void> {
  await db.setLogs.update(setId, patch);
}

/** Correct one drop on a set. Drops are positional, so index identifies it. */
export async function updateSetDrop(
  setId: string,
  index: number,
  patch: { weight?: number; reps?: number },
): Promise<void> {
  const row = await db.setLogs.get(setId);
  if (!row?.drops?.[index]) return;
  const drops = row.drops.map((d, i) => (i === index ? { ...d, ...patch } : d));
  await db.setLogs.update(setId, { drops });
}

export async function deleteSetDrop(
  setId: string,
  index: number,
): Promise<void> {
  const row = await db.setLogs.get(setId);
  if (!row?.drops?.[index]) return;
  const drops = row.drops.filter((_, i) => i !== index);
  await db.setLogs.update(setId, {
    drops: drops.length > 0 ? drops : undefined,
  });
}

/** Delete a set and renumber remaining sets for that exercise in the session. */
export async function deleteSetLog(setId: string): Promise<void> {
  const row = await db.setLogs.get(setId);
  if (!row) return;
  await db.setLogs.delete(setId);
  const siblings = (
    await db.setLogs.where("sessionId").equals(row.sessionId).toArray()
  )
    .filter((s) => s.exerciseId === row.exerciseId)
    .sort((a, b) => a.setNumber - b.setNumber);
  await Promise.all(
    siblings.map((s, i) =>
      s.setNumber === i + 1
        ? Promise.resolve()
        : db.setLogs.update(s.id, { setNumber: i + 1 }),
    ),
  );
}

export async function addSetToSession(opts: {
  sessionId: string;
  exerciseId: string;
  weightDisplay: number;
  reps: number;
  unit: Unit;
}): Promise<void> {
  const existing = (
    await db.setLogs.where("sessionId").equals(opts.sessionId).toArray()
  ).filter((s) => s.exerciseId === opts.exerciseId);
  const setNumber = existing.length + 1;
  await db.setLogs.add({
    id: newId(),
    sessionId: opts.sessionId,
    exerciseId: opts.exerciseId,
    setNumber,
    weight: toCanonical(opts.weightDisplay, opts.unit),
    reps: opts.reps,
    inputMethod: "manual",
  });
}

export function dayNameFor(
  session: WorkoutSession,
  templates: Map<string, DayTemplate>,
): string {
  return templates.get(session.dayTemplateId)?.name ?? "Session";
}
