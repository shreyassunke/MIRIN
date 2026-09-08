import { db, type NutritionLog } from "../db/db";
import { toLocalISODate } from "./rotation";

/** First-open defaults — a typical training day, not a blank field. */
export const DEFAULT_PROTEIN_G = 160;
export const DEFAULT_CALORIES = 2400;
export const PROTEIN_STEP = 5;
export const CALORIE_STEP = 50;

export function todayNutritionKey(): string {
  return toLocalISODate(new Date());
}

export async function lastLogBefore(
  dateKey: string,
): Promise<NutritionLog | undefined> {
  const all = await db.nutritionLogs.toArray();
  return all
    .filter((log) => log.id < dateKey)
    .sort((a, b) => b.id.localeCompare(a.id))[0];
}

export async function saveNutritionDay(
  dateKey: string,
  proteinG: number,
  calories: number,
): Promise<void> {
  const log: NutritionLog = {
    id: dateKey,
    proteinG,
    calories,
    updatedAt: new Date().toISOString(),
  };
  await db.nutritionLogs.put(log);
}
