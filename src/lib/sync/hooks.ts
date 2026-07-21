import { db } from "../../db/db";
import {
  SYNC_COLLECTIONS,
  isSyncableSettingKey,
  primaryKeyFor,
  type SyncCollection,
} from "./collections";
import { enqueueDelete, enqueueUpsert } from "./outbox";

let installed = false;

/**
 * Dexie hooks: every local create/update/delete becomes an outbox entry.
 * Sync itself applies remote rows with outbox suppressed.
 */
export function installSyncHooks(): void {
  if (installed) return;
  installed = true;

  for (const collection of SYNC_COLLECTIONS) {
    const table = tableForCollection(collection);

    table.hook("creating", function (this, _primKey, obj) {
      const row = obj as unknown as Record<string, unknown>;
      const docId = primaryKeyFor(collection, row);
      if (collection === "settings" && !isSyncableSettingKey(docId)) return;
      this.onsuccess = () => {
        void enqueueUpsert(collection, docId);
      };
    });

    table.hook("updating", function (this, _mods, primKey, obj) {
      const row = {
        ...(obj as unknown as Record<string, unknown>),
      };
      // Prefer the stable primary key; settings/prefs keys are not always `id`.
      const docId =
        collection === "settings" || collection === "exercisePrefs"
          ? primaryKeyFor(collection, row)
          : String(primKey);
      if (collection === "settings" && !isSyncableSettingKey(docId)) return;
      this.onsuccess = () => {
        void enqueueUpsert(collection, docId);
      };
    });

    table.hook("deleting", function (this, primKey, obj) {
      const row = (obj ?? {}) as unknown as Record<string, unknown>;
      const docId =
        obj != null
          ? primaryKeyFor(collection, row)
          : String(primKey);
      if (collection === "settings" && !isSyncableSettingKey(docId)) return;
      this.onsuccess = () => {
        void enqueueDelete(collection, docId);
      };
    });
  }
}

function tableForCollection(collection: SyncCollection) {
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
  }
}
