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
  /** Session-only ordered exercise list. Set on first swap/reorder; never writes to DayTemplate. */
  sessionExerciseIds?: string[];
  /** Maps replacement exerciseId → outgoing exerciseId at swap time (for SetLog audit). */
  exerciseSwapOrigins?: Record<string, string>;
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
  /** Set only when logged via a mid-workout exercise swap. */
  swappedFromExerciseId?: string;
}

export interface ExercisePreference {
  exerciseId: string;
  preferredInputMethod: InputMethod;
}

export interface Setting {
  key: string;
  value: string;
}

/** A target working-set PR for one exercise. */
export interface Goal {
  id: string;
  exerciseId: string;
  /** Target weight in canonical lbs. */
  targetWeight: number;
  createdAt: string;
}

/** One calendar day's protein and calories. `id` is YYYY-MM-DD local. */
export interface NutritionLog {
  id: string;
  proteinG: number;
  calories: number;
  updatedAt: string;
}

export type MeasurementKind = "mass" | "length";

/** A tracked body measurement. Seeded core fields plus user-added ones. */
export interface MeasurementField {
  id: string;
  label: string;
  kind: MeasurementKind;
  order: number;
  /** Core fields are seeded and cannot be removed. */
  isCore?: boolean;
  /** Target in canonical units (lbs for mass, cm for length). Absent = none. */
  target?: number;
  createdAt: string;
}

/** One dated reading for one field. Canonical: lbs for mass, cm for length. */
export interface MeasurementEntry {
  id: string;
  fieldId: string;
  /** Local calendar date, YYYY-MM-DD. */
  dateKey: string;
  value: number;
  updatedAt: string;
}

/** Pending cloud mutation. Flushed in the background after Dexie writes. */
export interface SyncOutboxEntry {
  id?: number;
  collection:
    | "exercises"
    | "dayTemplates"
    | "splits"
    | "sessions"
    | "setLogs"
    | "exercisePrefs"
    | "settings"
    | "goals"
    | "nutritionLogs"
    | "measurementFields"
    | "measurementEntries";
  docId: string;
  op: "upsert" | "delete";
  updatedAt: string;
}

export const db = new Dexie("mirin") as Dexie & {
  exercises: EntityTable<Exercise, "id">;
  dayTemplates: EntityTable<DayTemplate, "id">;
  splits: EntityTable<Split, "id">;
  sessions: EntityTable<WorkoutSession, "id">;
  setLogs: EntityTable<SetLog, "id">;
  exercisePrefs: EntityTable<ExercisePreference, "exerciseId">;
  settings: EntityTable<Setting, "key">;
  goals: EntityTable<Goal, "id">;
  nutritionLogs: EntityTable<NutritionLog, "id">;
  measurementFields: EntityTable<MeasurementField, "id">;
  measurementEntries: EntityTable<MeasurementEntry, "id">;
  syncOutbox: EntityTable<SyncOutboxEntry, "id">;
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

db.version(5).stores({});

db.version(6).stores({
  syncOutbox: "++id, [collection+docId], collection",
});

db.version(7).stores({
  goals: "id, exerciseId",
});

db.version(8).stores({
  nutritionLogs: "id",
});

db.version(9).stores({
  measurementFields: "id, order",
  measurementEntries: "id, fieldId, dateKey, [fieldId+dateKey]",
});

db.on("populate", seed);
