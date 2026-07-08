import { db, type SetLog, type WorkoutSession } from "../db/db";
import type { InputMethod } from "./units";

/** Estimated 1RM, Epley formula. */
export const epley = (weight: number, reps: number) =>
  reps <= 1 ? weight : weight * (1 + reps / 30);

export const DEFAULT_REST_SECONDS = 90;

/**
 * Sensible first-open input method per seeded exercise. Overridden by the
 * per-exercise preference once the user picks a mode.
 */
export const DEFAULT_INPUT_METHOD: Record<string, InputMethod> = {
  "incline-barbell-press": "barbell",
  "overhead-press": "barbell",
  "barbell-row": "barbell",
  "barbell-curl": "barbell",
  squat: "barbell",
  rdl: "barbell",
  "skull-crusher": "barbell",
  "flat-db-press": "dumbbell",
  "incline-db-press": "dumbbell",
  "lateral-raise": "dumbbell",
  "hammer-curl": "dumbbell",
  "rear-delt-flye": "dumbbell",
};

/**
 * First-open input method: the seeded map wins (unchanged behavior for the
 * original exercises), then the library hint stored on the exercise row.
 */
export const defaultInputMethodFor = (
  exerciseId: string,
  hint?: InputMethod,
): InputMethod => DEFAULT_INPUT_METHOD[exerciseId] ?? hint ?? "manual";

/** First-ever-session starting defaults (lb). Guide, never block. */
const START_WEIGHTS: Record<string, number> = {
  "incline-barbell-press": 95,
  "overhead-press": 65,
  "lateral-raise": 15,
  "flat-db-press": 50,
  "tricep-pushdown": 40,
  "wide-grip-pulldown": 100,
  "barbell-row": 95,
  "rear-delt-flye": 15,
  "face-pull": 30,
  "barbell-curl": 45,
  squat: 135,
  rdl: 135,
  "leg-press": 180,
  "leg-curl": 70,
  "calf-raise": 90,
  "skull-crusher": 40,
  "hammer-curl": 25,
  "overhead-tricep-extension": 30,
  "incline-db-press": 40,
  "cable-fly": 25,
  "lat-pulldown": 100,
  "cable-row": 100,
};

export const startWeightFor = (exerciseId: string) =>
  START_WEIGHTS[exerciseId] ?? 45;

/** Pump day defaults to higher reps. */
export const defaultRepsFor = (dayTemplateId: string) =>
  dayTemplateId === "chest-back" ? 12 : 8;

export const DEFAULT_TARGET_SETS = 3;

export interface SessionSets {
  session: WorkoutSession;
  sets: SetLog[];
}

/**
 * Per-session set history for an exercise, most recent first.
 * Only sessions that actually contain sets for the exercise count.
 */
export async function exerciseHistory(
  exerciseId: string,
  opts: { excludeSessionId?: string; limit?: number } = {},
): Promise<SessionSets[]> {
  const logs = await db.setLogs.where("exerciseId").equals(exerciseId).toArray();
  const bySession = new Map<string, SetLog[]>();
  for (const log of logs) {
    if (log.sessionId === opts.excludeSessionId) continue;
    const list = bySession.get(log.sessionId) ?? [];
    list.push(log);
    bySession.set(log.sessionId, list);
  }
  const sessions = (
    await db.sessions.bulkGet([...bySession.keys()])
  ).filter((s): s is WorkoutSession => s !== undefined);
  const result = sessions
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((session) => ({
      session,
      sets: bySession
        .get(session.id)!
        .sort((a, b) => a.setNumber - b.setNumber),
    }));
  return opts.limit ? result.slice(0, opts.limit) : result;
}

/** Most recent prior session's sets for an exercise (the prefill source). */
export async function lastSets(
  exerciseId: string,
  excludeSessionId?: string,
): Promise<SetLog[]> {
  const history = await exerciseHistory(exerciseId, {
    excludeSessionId,
    limit: 1,
  });
  return history[0]?.sets ?? [];
}

export const newId = () =>
  crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

export const formatWeight = (w: number) => String(parseFloat(w.toFixed(2)));
