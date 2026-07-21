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

export function formatDayHeading(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
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
