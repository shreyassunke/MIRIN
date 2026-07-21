import { db } from "../../db/db";
import type { Table } from "dexie";

/** Dexie tables that mirror to Supabase `sync_documents`. */
export const SYNC_COLLECTIONS = [
  "exercises",
  "dayTemplates",
  "splits",
  "sessions",
  "setLogs",
  "exercisePrefs",
  "settings",
  "goals",
] as const;

export type SyncCollection = (typeof SYNC_COLLECTIONS)[number];

/** Settings keys that stay device-local (never uploaded). */
export const LOCAL_SETTING_KEYS = new Set([
  "sync.userId",
  "sync.lastPulledAt",
  "sync.lastSyncedAt",
]);

export function isSyncableSettingKey(key: string): boolean {
  return !LOCAL_SETTING_KEYS.has(key) && !key.startsWith("sync.");
}

export function primaryKeyFor(
  collection: SyncCollection,
  row: Record<string, unknown>,
): string {
  if (collection === "exercisePrefs") return String(row.exerciseId);
  if (collection === "settings") return String(row.key);
  return String(row.id);
}

export function tableFor(collection: SyncCollection): Table {
  switch (collection) {
    case "exercises":
      return db.exercises;
    case "dayTemplates":
      return db.dayTemplates;
    case "splits":
      return db.splits;
    case "sessions":
      return db.sessions;
    case "setLogs":
      return db.setLogs;
    case "exercisePrefs":
      return db.exercisePrefs;
    case "settings":
      return db.settings;
    case "goals":
      return db.goals;
  }
}
