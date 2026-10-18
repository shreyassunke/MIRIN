import { db, type Goal, type SetLog, type WorkoutSession } from "../db/db";
import { newId } from "./workout";

/** Heaviest logged weight in a list. Warm-ups count, matching the history chip. */
export function heaviest(logs: { weight: number }[] | undefined): number {
  let best = 0;
  if (!logs) return best;
  for (const log of logs) if (log.weight > best) best = log.weight;
  return best;
}

/** Open targets this weight crosses: still unmet, and nothing heavier was logged before. */
export function crossedGoals(
  goals: Goal[],
  priorBestLb: number,
  weightLb: number,
): Goal[] {
  if (!(weightLb > 0)) return [];
  return goals.filter(
    (goal) =>
      !goal.achievedAt &&
      priorBestLb < goal.targetWeight &&
      weightLb >= goal.targetWeight,
  );
}

export function isGoalMet(goal: Goal, bestLb: number): boolean {
  return Boolean(goal.achievedAt) || (bestLb > 0 && bestLb >= goal.targetWeight);
}

/** Earliest session whose logged weight met the target. */
export function firstStrike(
  logs: SetLog[],
  sessions: Pick<WorkoutSession, "id" | "date">[],
  exerciseId: string,
  targetLb: number,
): { at: string; weight: number } | null {
  const sessionDate = new Map(sessions.map((session) => [session.id, session.date]));
  let earliest: { at: string; weight: number } | null = null;
  for (const log of logs) {
    if (log.exerciseId !== exerciseId || log.weight < targetLb) continue;
    const at = sessionDate.get(log.sessionId);
    if (!at) continue;
    if (
      !earliest ||
      at < earliest.at ||
      (at === earliest.at && log.weight < earliest.weight)
    ) {
      earliest = { at, weight: log.weight };
    }
  }
  return earliest;
}

export function formatRecordDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Heaviest working-set weight ever logged for an exercise (canonical lbs). */
export async function bestWeightFor(exerciseId: string): Promise<number> {
  const logs = await db.setLogs.where("exerciseId").equals(exerciseId).toArray();
  return logs.reduce((max, log) => Math.max(max, log.weight), 0);
}

export async function addGoal(
  exerciseId: string,
  targetWeightLbs: number,
): Promise<string> {
  const id = newId();
  const goal: Goal = {
    id,
    exerciseId,
    targetWeight: targetWeightLbs,
    createdAt: new Date().toISOString(),
  };
  await db.goals.add(goal);
  return id;
}

export async function updateGoalTarget(
  goalId: string,
  targetWeightLbs: number,
): Promise<void> {
  await db.goals.update(goalId, { targetWeight: targetWeightLbs });
}

export async function deleteGoal(goalId: string): Promise<void> {
  await db.goals.delete(goalId);
}

/** Stamp every open target this set crosses. Returns the goals as stored. */
export async function stampCrossedGoals(
  exerciseId: string,
  weightLb: number,
  priorBestLb: number,
  at = new Date().toISOString(),
): Promise<Goal[]> {
  const goals = await db.goals.where("exerciseId").equals(exerciseId).toArray();
  const hit = crossedGoals(goals, priorBestLb, weightLb);
  const stamped: Goal[] = [];
  for (const goal of hit) {
    await db.goals.update(goal.id, {
      achievedAt: at,
      achievedWeight: weightLb,
    });
    stamped.push({ ...goal, achievedAt: at, achievedWeight: weightLb });
  }
  return stamped;
}

/**
 * Write achievedAt for targets the log already met, without a ceremony.
 * Safe to call more than once.
 */
export async function sealMetGoals(): Promise<void> {
  const [goals, logs, sessions] = await Promise.all([
    db.goals.toArray(),
    db.setLogs.toArray(),
    db.sessions.toArray(),
  ]);
  for (const goal of goals) {
    if (goal.achievedAt) continue;
    const strike = firstStrike(logs, sessions, goal.exerciseId, goal.targetWeight);
    if (!strike) continue;
    await db.goals.update(goal.id, {
      achievedAt: strike.at,
      achievedWeight: strike.weight,
    });
  }
}

/** Best weight for an exercise ignoring one set, so an edit can cross a target. */
export async function priorBestExcluding(
  exerciseId: string,
  exceptLogId: string,
): Promise<number> {
  const logs = await db.setLogs.where("exerciseId").equals(exerciseId).toArray();
  return heaviest(logs.filter((log) => log.id !== exceptLogId));
}
