import Dexie, { type EntityTable } from "dexie";
import { seed } from "./seed";
import type { InputMethod } from "../lib/units";

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  priorityOrder: number;
}

export interface DayTemplate {
  id: string;
  name: string;
  exerciseIds: string[];
}

export interface Split {
  id: string;
  name: string;
  dayTemplateIds: string[];
}

export interface WorkoutSession {
  id: string;
  date: string; // ISO datetime
  dayTemplateId: string;
  completed: boolean;
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

db.on("populate", seed);
