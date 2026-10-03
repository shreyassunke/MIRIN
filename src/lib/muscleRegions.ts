import { libraryEntry } from "./library";
import { setVolume } from "./workout";
import type { Exercise, SetLog, WorkoutSession } from "../db/db";

/**
 * Training regions the physique can light up. Side and rear delts stay
 * distinct so a raise and a reverse flye do not collapse into "shoulders".
 *
 * Anatomical names below are the `userData.name` / `nameDetail` values from
 * public/models/body.glb (Z-Anatomy via hpfrei/body-anatomy-3d-viewer).
 */
export const REGION_IDS = [
  "front-delt",
  "side-delt",
  "rear-delt",
  "chest",
  "lats",
  "traps",
  "biceps",
  "triceps",
  "forearms",
  "abs",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "lower-back",
] as const;

export type RegionId = (typeof REGION_IDS)[number];

export const REGION_LABEL: Record<RegionId, string> = {
  "front-delt": "Front delts",
  "side-delt": "Side delts",
  "rear-delt": "Rear delts",
  chest: "Chest",
  lats: "Lats",
  traps: "Traps",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  abs: "Abs",
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
  "lower-back": "Lower back",
};

/** Library / Dexie primary-muscle tokens → a region. Shoulders default to the front head. */
const PRIMARY_TO_REGION: Record<string, RegionId> = {
  abdominals: "abs",
  abs: "abs",
  biceps: "biceps",
  calves: "calves",
  chest: "chest",
  forearms: "forearms",
  glutes: "glutes",
  hamstrings: "hamstrings",
  lats: "lats",
  back: "lats",
  "lower back": "lower-back",
  "middle back": "lats",
  quadriceps: "quads",
  quads: "quads",
  shoulders: "front-delt",
  traps: "traps",
  triceps: "triceps",
};

/**
 * Seeded weak-point lifts (and a few obvious aliases) that the coarse
 * library slug would otherwise dump into one shoulder or chest bucket.
 */
const EXERCISE_OVERRIDES: Record<string, RegionId> = {
  "lateral-raise": "side-delt",
  "rear-delt-flye": "rear-delt",
  "incline-barbell-press": "chest",
  "incline-db-press": "chest",
  "face-pull": "rear-delt",
};

export function regionFromAnatomy(
  name: string | undefined,
  detail: string | undefined,
): RegionId | null {
  const text = `${name ?? ""} ${detail ?? ""}`.toLowerCase();
  if (!text.trim()) return null;

  if (text.includes("deltoid")) {
    if (/spinal|posterior/.test(text)) return "rear-delt";
    if (/acromial|middle|lateral part/.test(text)) return "side-delt";
    if (/clavicular|anterior/.test(text)) return "front-delt";
    return "side-delt";
  }

  if (text.includes("infraspinatus") || text.includes("teres minor")) {
    return "rear-delt";
  }
  if (text.includes("supraspinatus")) return "side-delt";

  if (text.includes("pectoralis")) return "chest";
  if (text.includes("serratus anterior")) return "chest";

  if (
    text.includes("latissimus") ||
    text.includes("teres major") ||
    text.includes("rhomboid")
  ) {
    return "lats";
  }

  if (text.includes("trapezius")) return "traps";

  if (
    text.includes("biceps femoris") ||
    text.includes("semitendinosus") ||
    text.includes("semimembranosus")
  ) {
    return "hamstrings";
  }
  if (
    text.includes("biceps brachii") ||
    text.includes("short head of biceps") ||
    /(^|\s)biceps(\s|$)/.test(text)
  ) {
    return "biceps";
  }
  if (text.includes("brachialis")) return "biceps";

  if (text.includes("triceps") || text.includes("anconeus")) return "triceps";

  if (
    text.includes("brachioradialis") ||
    text.includes("flexor carpi") ||
    text.includes("extensor carpi") ||
    text.includes("flexor digitorum") ||
    text.includes("extensor digitorum") ||
    text.includes("palmaris") ||
    text.includes("pronator") ||
    text.includes("supinator")
  ) {
    return "forearms";
  }

  if (text.includes("rectus abdominis")) return "abs";
  if (text.includes("abdominal") && text.includes("oblique")) return "abs";
  if (text.includes("transverse abdominal") || text.includes("pyramidalis")) {
    return "abs";
  }

  if (
    text.includes("quadriceps") ||
    text.includes("vastus") ||
    text.includes("rectus femoris")
  ) {
    return "quads";
  }

  if (text.includes("gluteus") || text.includes("quadratus femoris")) {
    return "glutes";
  }

  if (
    text.includes("gastrocnemius") ||
    text.includes("soleus") ||
    text.includes("plantaris")
  ) {
    return "calves";
  }

  if (
    text.includes("erector spinae") ||
    text.includes("iliocostalis") ||
    text.includes("longissimus") ||
    text.includes("spinalis") ||
    text.includes("multifidus") ||
    text.includes("quadratus lumborum")
  ) {
    return "lower-back";
  }

  return null;
}

function regionFromExerciseName(name: string): RegionId | null {
  const n = name.toLowerCase();
  if (/rear\s*delt|reverse\s*fly|face\s*pull|bent.?over\s*lateral/.test(n)) {
    return "rear-delt";
  }
  if (/lateral\s*raise|side\s*raise|side\s*delt|lateral\s*delt/.test(n)) {
    return "side-delt";
  }
  if (/front\s*raise|front\s*delt/.test(n)) return "front-delt";
  return null;
}

export function regionForExercise(exercise: {
  id: string;
  name: string;
  muscleGroup?: string;
}): RegionId | null {
  const override = EXERCISE_OVERRIDES[exercise.id];
  if (override) return override;

  const fromName = regionFromExerciseName(exercise.name);
  if (fromName) return fromName;

  const primary = libraryEntry(exercise.id)?.primaryMuscles[0];
  if (primary) {
    const mapped = PRIMARY_TO_REGION[primary.toLowerCase()];
    if (mapped) return mapped;
  }

  const group = exercise.muscleGroup?.toLowerCase();
  if (group) {
    const mapped = PRIMARY_TO_REGION[group];
    if (mapped) return mapped;
  }

  return null;
}

export interface RegionContributor {
  id: string;
  name: string;
  volume: number;
}

export interface RegionVolume {
  total: number;
  /** Canonical lbs, keyed by completed session id. */
  bySession: Map<string, number>;
  contributors: RegionContributor[];
}

const emptyVolume = (): RegionVolume => ({
  total: 0,
  bySession: new Map(),
  contributors: [],
});

export function volumeByRegion(
  sessions: WorkoutSession[],
  logs: SetLog[],
  exercises: Exercise[],
): Record<RegionId, RegionVolume> {
  const completed = new Set(
    sessions.filter((s) => s.completed).map((s) => s.id),
  );
  const exerciseById = new Map(exercises.map((e) => [e.id, e]));
  const result = Object.fromEntries(
    REGION_IDS.map((id) => [id, emptyVolume()]),
  ) as Record<RegionId, RegionVolume>;
  const contrib = Object.fromEntries(
    REGION_IDS.map((id) => [id, new Map<string, number>()]),
  ) as Record<RegionId, Map<string, number>>;

  for (const log of logs) {
    if (!completed.has(log.sessionId)) continue;
    const exercise = exerciseById.get(log.exerciseId);
    if (!exercise) continue;
    const region = regionForExercise(exercise);
    if (!region) continue;
    const vol = setVolume(log);
    const bucket = result[region];
    bucket.total += vol;
    bucket.bySession.set(
      log.sessionId,
      (bucket.bySession.get(log.sessionId) ?? 0) + vol,
    );
    contrib[region].set(
      exercise.id,
      (contrib[region].get(exercise.id) ?? 0) + vol,
    );
  }

  for (const id of REGION_IDS) {
    result[id].contributors = [...contrib[id].entries()]
      .map(([exerciseId, volume]) => ({
        id: exerciseId,
        name: exerciseById.get(exerciseId)?.name ?? exerciseId,
        volume,
      }))
      .sort((a, b) => b.volume - a.volume);
  }

  return result;
}

/** 0–1 relative to the busiest region. Untrained regions stay 0. */
export function regionIntensities(
  volumes: Record<RegionId, RegionVolume>,
): Record<RegionId, number> {
  let max = 0;
  for (const id of REGION_IDS) max = Math.max(max, volumes[id].total);
  const out = {} as Record<RegionId, number>;
  for (const id of REGION_IDS) {
    out[id] = max > 0 ? volumes[id].total / max : 0;
  }
  return out;
}

export function busiestRegion(
  volumes: Record<RegionId, RegionVolume>,
): RegionId {
  let best: RegionId = "chest";
  let max = -1;
  for (const id of REGION_IDS) {
    if (volumes[id].total > max) {
      max = volumes[id].total;
      best = id;
    }
  }
  return best;
}
