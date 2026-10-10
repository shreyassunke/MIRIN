/**
 * Chest-seed schemas for the fiber module. Literature numbers carry `source`
 * and `verified`. A `source` of "TODO" is unfilled; `verified: false` means
 * the number is a placeholder and must not ship as fact.
 */

export type FiberType = "I" | "IIa" | "IIx";

/** Recruitment order. Type I is reached before IIa, IIa before IIx. */
export const FIBER_TYPE_ORDER: readonly FiberType[] = ["I", "IIa", "IIx"];

export type MuscleRole = "prime" | "synergist" | "stabilizer";

/**
 * One citation for the value it sits on. Weight and role share one entry
 * because a single EMG report is what will justify both.
 */
export interface Cited {
  /** Paper or dataset locator. "TODO" until filled in. */
  source: string;
  verified: boolean;
}

/** Type I + IIa + IIx shares. Expected to sum to 1. */
export interface FiberTypeRatio extends Cited {
  I: number;
  IIa: number;
  IIx: number;
}

export interface Muscle {
  id: string;
  /** Display name, e.g. "Pectoralis major, sternal head". */
  name: string;
  /**
   * Anatomical head, e.g. pectoralis_major_sternal.
   * BodyParts3D draws the sternal and costal fibers as one sternocostal part,
   * so this head maps to that mesh rather than a separate sternal file.
   */
  region: string;
  /** BodyParts3D FMA concept id. Left and right element files share it. */
  meshId: string;
  /** Left-side BodyParts3D element file (the mirrored OBJ). */
  elementId: string;
  fiberTypeRatio: FiberTypeRatio;
}

export interface MuscleInvolvement extends Cited {
  muscleId: string;
  /** Share of this exercise's demand on this head, from 0 to 1. */
  involvement: number;
  role: MuscleRole;
}

export interface ExerciseInvolvement {
  /** Id in src/data/exercises.json. */
  exerciseId: string;
  muscles: MuscleInvolvement[];
}

/**
 * Effective-effort level (0–1) at which each fiber type begins to recruit.
 * Ordered so I < IIa < IIx.
 */
export interface FiberTypeThresholds extends Cited {
  I: number;
  IIa: number;
  IIx: number;
}
