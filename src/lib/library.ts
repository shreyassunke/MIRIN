import staticLibrary from "../data/exercises.json";
import { db, type Exercise } from "../db/db";
import type { InputMethod } from "./units";

/**
 * How the load is applied. Drives which weight-input buttons appear and
 * what they are called — distinct from the raw equipment slug (kettlebell,
 * band, other) which stays on the library row for search.
 *
 * - barbell: free weight + barbell
 * - free-weight: dumbbells / kettlebells
 * - bodyweight
 * - machine: selectorized / plate-loaded machines (manual stepper)
 * - cable: cable stack (manual stepper)
 */
export type AttachmentType =
  | "barbell"
  | "free-weight"
  | "bodyweight"
  | "machine"
  | "cable";

export interface InputModeOption {
  id: InputMethod;
  label: string;
}

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
  attachment: AttachmentType;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  inputMethodHint: InputMethod;
  isCustom?: boolean;
  /** Selectorized station, set when a custom exercise names one. */
  station?: GymMachineId;
}

export const attachmentForEquipment = (equipment: string): AttachmentType => {
  switch (equipment) {
    case "barbell":
      return "barbell";
    case "dumbbell":
    case "kettlebell":
      return "free-weight";
    case "bodyweight":
      return "bodyweight";
    case "cable":
      return "cable";
    default:
      return "machine";
  }
};

/** Buttons shown for an exercise, labeled in attachment-type language. */
export const inputModesForEquipment = (
  equipment: string,
): InputModeOption[] => {
  switch (attachmentForEquipment(equipment)) {
    case "barbell":
      return [
        { id: "barbell", label: "Barbell" },
        { id: "dumbbell", label: "Dumbbell" },
        { id: "manual", label: "Type weight" },
      ];
    case "free-weight":
      return equipment === "kettlebell"
        ? [{ id: "manual", label: "Free Weight" }]
        : [{ id: "dumbbell", label: "Dumbbell" }];
    case "bodyweight":
      return [{ id: "manual", label: "Bodyweight" }];
    case "cable":
      return [{ id: "manual", label: "Cable" }];
    case "machine":
      return [{ id: "manual", label: "Type weight" }];
  }
};

export const resolveInputMethod = (
  equipment: string,
  preferred?: InputMethod,
): InputMethod => {
  const modes = inputModesForEquipment(equipment);
  if (preferred && modes.some((m) => m.id === preferred)) return preferred;
  return modes[0]?.id ?? "manual";
};

/**
 * Equipment slug used for attachment / input UI. Static library rows win
 * over a stale Dexie copy so recategorization (e.g. lat pulldown → machine)
 * applies immediately; custom exercises keep the stored slug.
 */
export const equipmentForExercise = (exercise: {
  id: string;
  equipment?: string;
  isCustom?: boolean;
}): string => {
  if (exercise.isCustom) return exercise.equipment ?? "other";
  return libraryEntry(exercise.id)?.equipment ?? exercise.equipment ?? "other";
};

const withAttachment = (
  entry: Omit<ExerciseLibraryEntry, "attachment">,
): ExerciseLibraryEntry => ({
  ...entry,
  attachment: attachmentForEquipment(entry.equipment),
});

export const STATIC_LIBRARY: ExerciseLibraryEntry[] =
  staticLibrary.map(withAttachment);

const staticById = new Map(STATIC_LIBRARY.map((e) => [e.id, e]));

export const libraryEntry = (id: string) => staticById.get(id);

const LAT_PULLDOWN_IDS = new Set([
  "lat-pulldown",
  "wide-grip-pulldown",
  "close-grip-front-lat-pulldown",
  "full-range-of-motion-lat-pulldown",
  "one-arm-lat-pulldown",
]);

/** The selectorized lat-pulldown, including grip variants of the same machine. */
export function isLatPulldownMachine(exercise: { id: string; name: string }) {
  return (
    LAT_PULLDOWN_IDS.has(exercise.id) || /\blat pulldown\b/i.test(exercise.name)
  );
}

export type GymMachineId =
  | "lat-pulldown"
  | "cable"
  | "seated-row"
  | "leg-curl"
  | "pec-deck"
  | "leg-press"
  | "calf-raise"
  | "t-bar-row"
  | "leg-extension"
  | "inner-thigh"
  | "outer-thigh"
  | "preacher"
  | "seated-dip"
  | "lateral-raise"
  | "chest-press";

const GYM_MACHINE_IDS: readonly GymMachineId[] = [
  "lat-pulldown",
  "cable",
  "seated-row",
  "leg-curl",
  "pec-deck",
  "leg-press",
  "calf-raise",
  "t-bar-row",
  "leg-extension",
  "inner-thigh",
  "outer-thigh",
  "preacher",
  "seated-dip",
  "lateral-raise",
  "chest-press",
];

export function isGymMachineId(value: string): value is GymMachineId {
  return (GYM_MACHINE_IDS as readonly string[]).includes(value);
}

/** Muscles a station trains, matching the library's primary and the ones it is built for. */
const STATION_MUSCLES: Partial<Record<GymMachineId, readonly string[]>> = {
  "chest-press": ["chest"],
  "pec-deck": ["chest"],
  "seated-dip": ["chest", "triceps"],
  "lat-pulldown": ["lats", "middle back"],
  "seated-row": ["lats", "middle back"],
  "t-bar-row": ["lats", "middle back"],
  "lateral-raise": ["shoulders"],
  preacher: ["biceps"],
  "leg-extension": ["quadriceps"],
  "leg-curl": ["hamstrings"],
  "leg-press": ["quadriceps", "glutes", "hamstrings", "calves"],
  "calf-raise": ["calves"],
  "inner-thigh": ["adductors"],
  "outer-thigh": ["abductors", "glutes"],
};

const STATION_PICK_ORDER: readonly GymMachineId[] = [
  "chest-press",
  "pec-deck",
  "seated-dip",
  "lat-pulldown",
  "seated-row",
  "t-bar-row",
  "lateral-raise",
  "preacher",
  "leg-extension",
  "leg-curl",
  "leg-press",
  "calf-raise",
  "inner-thigh",
  "outer-thigh",
];

/** Stations to offer when a custom exercise names this muscle. */
export function stationsForMuscle(muscle: string): GymMachineId[] {
  const key = muscle.toLowerCase();
  return STATION_PICK_ORDER.filter((id) => STATION_MUSCLES[id]?.includes(key));
}

/**
 * Stations for this lift when the lifter switches onto a machine.
 * A rear-delt fly shares the pec deck with chest flies, then the back
 * stations. The library files those lifts under shoulders, which would
 * otherwise offer only the lateral raise.
 */
export function stationsForExercise(exercise: {
  id: string;
  name: string;
  muscleGroup?: string;
}): GymMachineId[] {
  const text = `${exercise.id} ${exercise.name}`.toLowerCase();
  if (/rear[-\s]?delt|reverse\s*fly/.test(text)) {
    return ["pec-deck", ...stationsForMuscle("lats")];
  }
  if (/face\s*pull|bent.?over\s*lateral/.test(text)) {
    return stationsForMuscle("lats");
  }
  return exercise.muscleGroup ? stationsForMuscle(exercise.muscleGroup) : [];
}

/**
 * Which station sits under the number. Selectorized stations are the mesh.
 * Other cable work is the clip. Lying leg curl is the seeded Leg Curl; seated
 * and standing curls stay bare. Plate-loaded and free-weight names match only
 * when the lifter is actually on a machine, so barbell, dumbbell, and Smith
 * variants keep their own instruments. A station saved on a custom
 * exercise wins over the name, and only while the lifter is on a machine.
 */
export function gymMachineFor(exercise: {
  id: string;
  name: string;
  equipment?: string;
  isCustom?: boolean;
  station?: string;
}): GymMachineId | null {
  const equipment = equipmentForExercise(exercise);
  if (
    exercise.station &&
    isGymMachineId(exercise.station) &&
    exercise.station !== "cable" &&
    equipment === "machine"
  ) {
    return exercise.station;
  }
  if (isLatPulldownMachine(exercise)) return "lat-pulldown";
  if (
    equipment === "cable" &&
    (exercise.id === "cable-row" || /\bseated (cable )?rows?\b/i.test(exercise.name))
  ) {
    return "seated-row";
  }
  if (equipment === "cable") return "cable";
  if (equipment === "machine" && !/\bsmith\b/i.test(exercise.name)) {
    if (/\bchest press\b/i.test(exercise.name)) return "chest-press";
    if (/\bleg press\b/i.test(exercise.name)) return "leg-press";
    if (exercise.id === "calf-raise" || /\bstanding calf raises?\b/i.test(exercise.name)) {
      return "calf-raise";
    }
    if (exercise.id === "lying-t-bar-row" || /\bt[-\s]?bar rows?\b/i.test(exercise.name)) {
      return "t-bar-row";
    }
    if (
      exercise.id === "leg-extensions" ||
      exercise.id === "single-leg-leg-extension" ||
      /\bleg extensions?\b/i.test(exercise.name)
    ) {
      return "leg-extension";
    }
    if (
      exercise.id === "thigh-adductor" ||
      /\b(adductors?|adductions?|inner thighs?)\b/i.test(exercise.name)
    ) {
      return "inner-thigh";
    }
    if (
      exercise.id === "thigh-abductor" ||
      /\b(abductors?|abductions?|outer thighs?)\b/i.test(exercise.name)
    ) {
      return "outer-thigh";
    }
    if (exercise.id === "machine-preacher-curls" || /\bpreacher\b/i.test(exercise.name)) {
      return "preacher";
    }
    if (
      exercise.id === "dip-machine" ||
      (/\bdips?\b/i.test(exercise.name) && !/\b(bench|ring|jerk|parallel)\b/i.test(exercise.name))
    ) {
      return "seated-dip";
    }
    if (
      (exercise.id === "lateral-raise" || /\blateral raises?\b/i.test(exercise.name)) &&
      !/\b(rear|lying|bent)\b/i.test(exercise.name)
    ) {
      return "lateral-raise";
    }
  }
  if (exercise.id === "leg-curl" || /\blying leg curls?\b/i.test(exercise.name)) {
    return "leg-curl";
  }
  if (exercise.id === "butterfly" || /\b(pec[-\s]?deck|butterfly)\b/i.test(exercise.name)) {
    return "pec-deck";
  }
  return null;
}

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

const EQUIPMENT_LABELS: Record<string, string> = {
  barbell: "Barbell",
  dumbbell: "Free weight",
  kettlebell: "Kettlebell",
  bodyweight: "Bodyweight",
  machine: "Machine",
  cable: "Cable",
  band: "Band",
  other: "Other",
};

export const equipmentLabel = (equipment: string) =>
  EQUIPMENT_LABELS[equipment] ??
  equipment.charAt(0).toUpperCase() + equipment.slice(1);

/**
 * The visible lift name follows the implement the lifter is actually holding.
 * "Incline Barbell Press" on the dumbbell page reads "Incline Dumbbell Press".
 * Manual entry keeps the stored name. History stays on the original exercise.
 */
export function exerciseLabelForMethod(
  name: string,
  method: InputMethod,
): string {
  if (method !== "barbell" && method !== "dumbbell") return name;
  if (!/\b(barbells?|dumbbells?|dbs?)\b/i.test(name)) return name;
  const next = method === "barbell" ? "Barbell" : "Dumbbell";
  return name.replace(/\b(barbells?|dumbbells?|dbs?)\b/gi, (token) =>
    token[0] === token[0].toUpperCase() ? next : next.toLowerCase(),
  );
}

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

const customToEntry = (exercise: Exercise): ExerciseLibraryEntry => {
  const equipment = exercise.equipment ?? "other";
  return {
    id: exercise.id,
    name: exercise.name,
    aliases: [],
    category: "custom",
    equipment,
    attachment: attachmentForEquipment(equipment),
    primaryMuscles: [exercise.muscleGroup],
    secondaryMuscles: [],
    inputMethodHint:
      exercise.inputMethodHint ?? inputMethodForEquipment(equipment),
    isCustom: true,
    station:
      exercise.station && isGymMachineId(exercise.station)
        ? exercise.station
        : undefined,
  };
};

/** Static library plus the user's custom exercises, custom first. */
export async function fullLibrary(): Promise<ExerciseLibraryEntry[]> {
  const rows = await db.exercises.toArray();
  const names = new Map(rows.map((row) => [row.id, row.name]));
  const custom = rows.filter((row) => row.isCustom === true).map(customToEntry);
  const library = STATIC_LIBRARY.map((entry) => {
    const name = names.get(entry.id);
    if (!name || name === entry.name) return entry;
    const aliases = entry.aliases.includes(entry.name)
      ? entry.aliases
      : [entry.name, ...entry.aliases];
    return { ...entry, name, aliases };
  });
  return [...custom, ...library];
}

/** Persists a new exercise title. Blank and unchanged names are ignored. */
export async function renameExercise(id: string, name: string) {
  const next = name.trim();
  if (!next) return;
  const row = await db.exercises.get(id);
  if (!row || row.name === next) return;
  await db.exercises.update(id, { name: next });
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
    station: entry.station,
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
  station?: string;
}): Promise<ExerciseLibraryEntry> {
  const base = `custom-${slug(input.name)}`;
  let id = base;
  for (let n = 2; await db.exercises.get(id); n++) id = `${base}-${n}`;
  const station =
    input.equipment === "machine" && input.station && isGymMachineId(input.station)
      ? input.station
      : undefined;
  const exercise: Exercise = {
    id,
    name: input.name.trim(),
    muscleGroup: muscleLabel(input.primaryMuscle),
    priorityOrder: (await db.exercises.count()) + 1,
    equipment: input.equipment,
    inputMethodHint: inputMethodForEquipment(input.equipment),
    isCustom: true,
    station,
  };
  await db.exercises.add(exercise);
  return customToEntry(exercise);
}
