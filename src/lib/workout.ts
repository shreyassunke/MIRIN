import {
  db,
  type LoadBreakdown,
  type SetDrop,
  type SetLog,
  type WorkoutSession,
} from "../db/db";
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

/** Total weight×reps for a set, drops included. */
export const setVolume = (log: SetLog) =>
  log.weight * log.reps +
  (log.drops ?? []).reduce((sum, d) => sum + d.weight * d.reps, 0);

/**
 * A set as one ledger entry: "135×8" plain, "135×8 → 105×6" once dropped.
 * `display` converts canonical lbs to the reader's unit.
 */
export const formatSet = (log: SetLog, display: (lb: number) => number) =>
  [log, ...(log.drops ?? [])]
    .map((s) => `${formatWeight(display(s.weight))}×${s.reps}`)
    .join(" → ");

/** One set copied forward from a previous session, ready to insert. */
export interface PlannedSet {
  exerciseId: string;
  setNumber: number;
  weight: number;
  reps: number;
  inputMethod?: InputMethod;
  loadBreakdown?: LoadBreakdown;
  drops?: SetDrop[];
}

/**
 * Sets that would bring each exercise up to the count it carried last session,
 * copied verbatim from it. Exercises with no history are skipped — the log
 * never invents a lift that was not performed. So are exercises the user
 * already called done, whose set count is a deliberate choice.
 */
export function planFillFromLastTime(
  exercises: { id: string }[],
  prefills: Record<string, SetLog[]>,
  loggedByExercise: Map<string, SetLog[]>,
  finishedExerciseIds: ReadonlySet<string> = new Set(),
): PlannedSet[] {
  const planned: PlannedSet[] = [];
  for (const exercise of exercises) {
    if (finishedExerciseIds.has(exercise.id)) continue;
    const prior = prefills[exercise.id] ?? [];
    const alreadyLogged = loggedByExercise.get(exercise.id)?.length ?? 0;
    for (let i = alreadyLogged; i < prior.length; i++) {
      const source = prior[i];
      planned.push({
        exerciseId: exercise.id,
        setNumber: i + 1,
        weight: source.weight,
        reps: source.reps,
        inputMethod: source.inputMethod,
        loadBreakdown: source.loadBreakdown,
        drops: source.drops,
      });
    }
  }
  return planned;
}

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
