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
