import { db } from "../../db/db";
import { seed } from "../../db/seed";
import { getSupabase } from "../supabase";
import {
  SYNC_COLLECTIONS,
  isSyncableSettingKey,
  tableFor,
  type SyncCollection,
} from "./collections";
import { enqueueAllLocal, withSyncSuppressed } from "./outbox";

const PUSH_CHUNK = 80;
const USER_ID_KEY = "sync.userId";
const LAST_PULLED_KEY = "sync.lastPulledAt";
const LAST_SYNCED_KEY = "sync.lastSyncedAt";

export type SyncStatus =
  | "idle"
  | "syncing"
  | "synced"
  | "offline"
  | "error"
  | "disabled";

export interface SyncState {
  status: SyncStatus;
  lastSyncedAt: string | null;
  error: string | null;
}

interface RemoteDoc {
  user_id: string;
  collection: string;
  id: string;
  data: Record<string, unknown>;
  updated_at: string;
  deleted_at: string | null;
}

let syncing = false;

export async function readSyncState(): Promise<SyncState> {
  const lastSyncedAt =
    (await db.settings.get(LAST_SYNCED_KEY))?.value ?? null;
  if (!navigator.onLine) {
    return { status: "offline", lastSyncedAt, error: null };
  }
  return {
    status: lastSyncedAt ? "synced" : "idle",
    lastSyncedAt,
    error: null,
  };
}

/**
 * Bind the local DB to a Supabase user. First login claims existing history;
 * switching accounts resets local data and pulls the other account.
 */
export async function bindSyncUser(userId: string): Promise<void> {
  const current = (await db.settings.get(USER_ID_KEY))?.value;
  if (current === userId) return;

  if (current && current !== userId) {
    await resetLocalData();
    await db.settings.put({ key: USER_ID_KEY, value: userId });
    await db.settings.put({ key: LAST_PULLED_KEY, value: "" });
    return;
  }

  // First bind on this device: keep local rows and queue a full upload.
  await db.settings.put({ key: USER_ID_KEY, value: userId });
  await enqueueAllLocal();
}

async function resetLocalData(): Promise<void> {
  await withSyncSuppressed(async () => {
    await db.transaction(
      "rw",
      [
        db.exercises,
        db.dayTemplates,
        db.splits,
        db.sessions,
        db.setLogs,
        db.exercisePrefs,
        db.settings,
        db.syncOutbox,
      ],
      async () => {
        await Promise.all([
          db.exercises.clear(),
          db.dayTemplates.clear(),
          db.splits.clear(),
          db.sessions.clear(),
          db.setLogs.clear(),
          db.exercisePrefs.clear(),
          db.settings.clear(),
          db.syncOutbox.clear(),
        ]);
      },
    );
  });
}

/** Push outbox then pull remote changes. Safe to call often; coalesces. */
export async function runSync(userId: string): Promise<SyncState> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      status: "disabled",
      lastSyncedAt: null,
      error: "Supabase is not configured.",
    };
  }

  if (!navigator.onLine) {
    const lastSyncedAt =
      (await db.settings.get(LAST_SYNCED_KEY))?.value ?? null;
    return { status: "offline", lastSyncedAt, error: null };
  }

  if (syncing) {
    return readSyncState();
  }

  syncing = true;
  try {
    await bindSyncUser(userId);
    await pushOutbox(userId);
    await pullRemote(userId);

    // Empty account on a wiped device: seed defaults, then upload.
    if ((await db.exercises.count()) === 0) {
      await db.transaction(
        "rw",
        db.exercises,
        db.dayTemplates,
        db.splits,
        async (tx) => {
          await seed(tx);
        },
      );
      await enqueueAllLocal();
      await pushOutbox(userId);
    }

    const now = new Date().toISOString();
    await db.settings.put({ key: LAST_SYNCED_KEY, value: now });
    return { status: "synced", lastSyncedAt: now, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Sync failed. Will retry.";
    const lastSyncedAt =
      (await db.settings.get(LAST_SYNCED_KEY))?.value ?? null;
    return { status: "error", lastSyncedAt, error: message };
  } finally {
    syncing = false;
  }
}

async function pushOutbox(userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  for (;;) {
    const batch = await db.syncOutbox.orderBy("id").limit(PUSH_CHUNK).toArray();
    if (batch.length === 0) return;

    const rows: RemoteDoc[] = [];
    const deleteIds: number[] = [];

    for (const entry of batch) {
      if (entry.id == null) continue;
      deleteIds.push(entry.id);

      if (entry.op === "delete") {
        rows.push({
          user_id: userId,
          collection: entry.collection,
          id: entry.docId,
          data: {},
          updated_at: entry.updatedAt,
          deleted_at: entry.updatedAt,
        });
        continue;
      }

      const table = tableFor(entry.collection);
      const local = await table.get(entry.docId);
      if (!local) {
        // Row vanished; a delete entry should follow. Skip upsert.
        continue;
      }
      if (
        entry.collection === "settings" &&
        !isSyncableSettingKey(entry.docId)
      ) {
        continue;
      }

      rows.push({
        user_id: userId,
        collection: entry.collection,
        id: entry.docId,
        data: local as unknown as Record<string, unknown>,
        updated_at: entry.updatedAt,
        deleted_at: null,
      });
    }

    if (rows.length > 0) {
      const { error } = await supabase.from("sync_documents").upsert(rows, {
        onConflict: "user_id,collection,id",
      });
      if (error) throw new Error(error.message);
    }

    await db.syncOutbox.bulkDelete(deleteIds);
  }
}

async function pullRemote(userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const lastPulled =
    (await db.settings.get(LAST_PULLED_KEY))?.value?.trim() || null;

  let query = supabase
    .from("sync_documents")
    .select("user_id,collection,id,data,updated_at,deleted_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: true });

  if (lastPulled) {
    query = query.gt("updated_at", lastPulled);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const docs = (data ?? []) as RemoteDoc[];
  if (docs.length === 0) return;

  const pendingKeys = new Set(
    (await db.syncOutbox.toArray()).map(
      (e) => `${e.collection}\0${e.docId}`,
    ),
  );

  let maxUpdated = lastPulled;

  await withSyncSuppressed(async () => {
    await db.transaction(
      "rw",
      [
        db.exercises,
        db.dayTemplates,
        db.splits,
        db.sessions,
        db.setLogs,
        db.exercisePrefs,
        db.settings,
      ],
      async () => {
        for (const doc of docs) {
          if (!isSyncCollection(doc.collection)) continue;
          if (
            doc.collection === "settings" &&
            !isSyncableSettingKey(doc.id)
          ) {
            continue;
          }

          // Pending local change for this doc wins until pushed.
          if (pendingKeys.has(`${doc.collection}\0${doc.id}`)) continue;

          const table = tableFor(doc.collection);

          if (doc.deleted_at) {
            await table.delete(doc.id);
          } else if (doc.data && typeof doc.data === "object") {
            await table.put(doc.data as never);
          }

          if (!maxUpdated || doc.updated_at > maxUpdated) {
            maxUpdated = doc.updated_at;
          }
        }
      },
    );
  });

  if (maxUpdated) {
    await db.settings.put({ key: LAST_PULLED_KEY, value: maxUpdated });
  }
}

function isSyncCollection(value: string): value is SyncCollection {
  return (SYNC_COLLECTIONS as readonly string[]).includes(value);
}
