import Dexie, { type EntityTable } from "dexie";
import { seed, REST_DAY_TEMPLATE, DEFAULT_SPLIT_ID } from "./seed";
import { DEFAULT_ANCHOR_DATE } from "../lib/rotation";
import type { InputMethod } from "../lib/units";

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  priorityOrder: number;
  /** Library equipment slug, set for exercises added from the library. */
  equipment?: string;
  /** First-open weight input mode; overridden by the saved preference. */
  inputMethodHint?: InputMethod;
  /** True only for user-created exercises absent from the static library. */
  isCustom?: boolean;
}

export interface DayTemplate {
  id: string;
  name: string;
  exerciseIds: string[];
  isRestDay?: boolean;
}

export interface Split {
  id: string;
  name: string;
  /** Ordered rotation, any length. May repeat ids (e.g. rest slots). */
  dayTemplateIds: string[];
  /** Only one split is active at a time; drives the Today screen. */
  isActive: boolean;
  /** The original seeded split: undeletable, always listed first. */
  isDefault?: boolean;
  /** Local date (YYYY-MM-DD) pinned to `anchorIndex` in the rotation. */
  anchorDate?: string;
  anchorIndex?: number;
}

export interface WorkoutSession {
  id: string;
  date: string; // ISO datetime
  dayTemplateId: string;
  completed: boolean;
  /** Exercises added mid-workout; not written back to the day template. */
  extraExerciseIds?: string[];
}

export interface LoadBreakdown {
  barWeight?: number; // canonical lbs
  platesPerSide?: number[]; // canonical lbs
}

export interface SetLog {
  id: string;
  sessionId: string;
  exerciseId: string;
  setNumber: number;
  weight: number; // canonical, stored in lbs
  reps: number;
  rpe?: number;
  inputMethod?: InputMethod;
  loadBreakdown?: LoadBreakdown;
}

export interface ExercisePreference {
  exerciseId: string;
  preferredInputMethod: InputMethod;
}

export interface Setting {
  key: string;
  value: string;
}

export const db = new Dexie("mirin") as Dexie & {
  exercises: EntityTable<Exercise, "id">;
  dayTemplates: EntityTable<DayTemplate, "id">;
  splits: EntityTable<Split, "id">;
  sessions: EntityTable<WorkoutSession, "id">;
  setLogs: EntityTable<SetLog, "id">;
  exercisePrefs: EntityTable<ExercisePreference, "exerciseId">;
  settings: EntityTable<Setting, "key">;
};

db.version(1).stores({
  exercises: "id, name, priorityOrder",
  dayTemplates: "id",
  splits: "id",
  sessions: "id, date, dayTemplateId",
  setLogs: "id, sessionId, exerciseId, [exerciseId+sessionId]",
});

db.version(2).stores({
  exercisePrefs: "exerciseId",
  settings: "key",
});

interface SplitV3 extends Split {
  /** v3 shape: Mon–Fri day template ids; weekends were implicit rest. */
  weekSchedule?: string[];
}

db.version(3)
  .stores({})
  .upgrade(async (tx) => {
    const defaultWeek = ["push", "pull", "legs", "arms", "chest-back"];
    await tx
      .table("splits")
      .toCollection()
      .modify((split: SplitV3) => {
        if (!split.weekSchedule?.length) {
          split.weekSchedule =
            split.dayTemplateIds.length >= 5
              ? split.dayTemplateIds.slice(0, 5)
              : defaultWeek;
        }
      });
  });

// v4: splits become variable-length rotations with explicit rest slots.
// The weekly Mon–Fri schedule converts to a 7-slot loop anchored to a
// Monday, which produces identical scheduling to the old weekday logic.
db.version(4)
  .stores({})
  .upgrade(async (tx) => {
    const dayTemplates = tx.table("dayTemplates");
    if (!(await dayTemplates.get(REST_DAY_TEMPLATE.id))) {
      await dayTemplates.add(REST_DAY_TEMPLATE);
    }
    const splits = tx.table("splits");
    const all = (await splits.toArray()) as SplitV3[];
    const anyActive = all.some((s) => s.isActive);
    await splits.toCollection().modify((split: SplitV3) => {
      if (split.weekSchedule?.length) {
        split.dayTemplateIds = [
          ...split.weekSchedule,
          REST_DAY_TEMPLATE.id,
          REST_DAY_TEMPLATE.id,
        ];
        split.anchorDate = DEFAULT_ANCHOR_DATE;
        split.anchorIndex = 0;
        delete split.weekSchedule;
      }
      if (split.isDefault === undefined) {
        split.isDefault = split.id === DEFAULT_SPLIT_ID;
      }
      if (!anyActive) {
        split.isActive = split.id === DEFAULT_SPLIT_ID || all.length === 1;
      }
    });
  });

db.on("populate", seed);
