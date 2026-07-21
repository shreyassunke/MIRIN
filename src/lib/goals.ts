import { db, type Goal } from "../db/db";
import { newId } from "./workout";

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
