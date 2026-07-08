import staticLibrary from "../data/exercises.json";
import { db, type Exercise } from "../db/db";
import type { InputMethod } from "./units";

/**
 * One entry in the exercise library. The static portion is vendored at
 * build time from free-exercise-db (see scripts/build-exercise-library.mjs);
 * user-created custom exercises are stored in Dexie and merged at query time.
 */
export interface ExerciseLibraryEntry {
  id: string;
  name: string;
  aliases: string[];
  category: string;
  equipment: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  inputMethodHint: InputMethod;
  isCustom?: boolean;
}

export const STATIC_LIBRARY: ExerciseLibraryEntry[] = staticLibrary;

const staticById = new Map(STATIC_LIBRARY.map((e) => [e.id, e]));

export const libraryEntry = (id: string) => staticById.get(id);

/** Friendly labels for the dataset's muscle slugs. */
const MUSCLE_LABELS: Record<string, string> = {
  abdominals: "Abs",
  abductors: "Abductors",
  adductors: "Adductors",
  biceps: "Biceps",
  calves: "Calves",
  chest: "Chest",
  forearms: "Forearms",
  glutes: "Glutes",
  hamstrings: "Hamstrings",
  lats: "Back",
  "lower back": "Lower Back",
  "middle back": "Back",
  neck: "Neck",
  quadriceps: "Quads",
  shoulders: "Shoulders",
  traps: "Traps",
  triceps: "Triceps",
};

export const muscleLabel = (muscle: string) =>
  MUSCLE_LABELS[muscle.toLowerCase()] ??
  muscle.charAt(0).toUpperCase() + muscle.slice(1);

export const equipmentLabel = (equipment: string) =>
  equipment.charAt(0).toUpperCase() + equipment.slice(1);

/** Equipment options for the create-custom form. */
export const EQUIPMENT_OPTIONS = [
  "barbell",
  "dumbbell",
  "bodyweight",
  "cable",
  "machine",
  "kettlebell",
  "band",
  "other",
] as const;

export const MUSCLE_OPTIONS = Object.keys(MUSCLE_LABELS);

export const inputMethodForEquipment = (equipment: string): InputMethod =>
  equipment === "barbell"
    ? "barbell"
    : equipment === "dumbbell"
      ? "dumbbell"
      : "manual";

const customToEntry = (exercise: Exercise): ExerciseLibraryEntry => ({
  id: exercise.id,
  name: exercise.name,
  aliases: [],
  category: "custom",
  equipment: exercise.equipment ?? "other",
  primaryMuscles: [exercise.muscleGroup],
  secondaryMuscles: [],
  inputMethodHint:
    exercise.inputMethodHint ??
    inputMethodForEquipment(exercise.equipment ?? "other"),
  isCustom: true,
});

/** Static library plus the user's custom exercises, custom first. */
export async function fullLibrary(): Promise<ExerciseLibraryEntry[]> {
  const custom = await db.exercises.filter((e) => e.isCustom === true).toArray();
  return [...custom.map(customToEntry), ...STATIC_LIBRARY];
}

/**
 * Guarantees a row in db.exercises for a library entry so day templates and
 * set logs can reference it. Existing rows (including the original seeded
 * 25) are left untouched, preserving their names and history.
 */
export async function ensureExerciseRow(
  entry: ExerciseLibraryEntry,
): Promise<string> {
  const existing = await db.exercises.get(entry.id);
  if (existing) return existing.id;
  const count = await db.exercises.count();
  await db.exercises.add({
    id: entry.id,
    name: entry.name,
    muscleGroup: muscleLabel(entry.primaryMuscles[0] ?? "other"),
    priorityOrder: count + 1,
    equipment: entry.equipment,
    inputMethodHint: entry.inputMethodHint,
    isCustom: entry.isCustom,
  });
  return entry.id;
}

const slug = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * Creates a user-defined exercise absent from the static library. The id is
 * slug-based with a `custom-` prefix so it can never collide with (or be
 * shadowed by) a future static entry.
 */
export async function createCustomExercise(input: {
  name: string;
  equipment: string;
  primaryMuscle: string;
}): Promise<ExerciseLibraryEntry> {
  const base = `custom-${slug(input.name)}`;
  let id = base;
  for (let n = 2; await db.exercises.get(id); n++) id = `${base}-${n}`;
  const exercise: Exercise = {
    id,
    name: input.name.trim(),
    muscleGroup: muscleLabel(input.primaryMuscle),
    priorityOrder: (await db.exercises.count()) + 1,
    equipment: input.equipment,
    inputMethodHint: inputMethodForEquipment(input.equipment),
    isCustom: true,
  };
  await db.exercises.add(exercise);
  return customToEntry(exercise);
}
