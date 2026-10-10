import exercises from "./exercises.json";
import fiberTypeThresholds from "./fiberTypeThresholds.json";
import muscles from "./muscles.json";
import type {
  ExerciseInvolvement,
  FiberTypeThresholds,
  Muscle,
} from "./types";

/** Checked against the schema. Every literature number is still unverified. */
export const muscleCatalog: Muscle[] = muscles satisfies Muscle[];
export const exerciseCatalog: ExerciseInvolvement[] =
  exercises satisfies ExerciseInvolvement[];
export const thresholds: FiberTypeThresholds =
  fiberTypeThresholds satisfies FiberTypeThresholds;
