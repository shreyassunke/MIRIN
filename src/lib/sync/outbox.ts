import { db, type SyncOutboxEntry } from "../../db/db";
import {
  SYNC_COLLECTIONS,
  isSyncableSettingKey,
  primaryKeyFor,
  tableFor,
  type SyncCollection,
} from "./collections";

/** Depth counter: remote apply / account reset must not enqueue. */
let suppressOutbox = 0;

export function withSyncSuppressed<T>(fn: () => Promise<T>): Promise<T> {
  suppressOutbox += 1;
  return fn().finally(() => {
    suppressOutbox -= 1;
  });
}

export function isSyncSuppressed(): boolean {
  return suppressOutbox > 0;
}

type SyncListener = () => void;
const listeners = new Set<SyncListener>();

/** Called after local mutations so the sync loop can wake up. */
export function onOutboxChange(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyOutboxChange() {
  for (const listener of listeners) listener();
}

export async function enqueueUpsert(
  collection: SyncCollection,
  docId: string,
): Promise<void> {
  if (suppressOutbox > 0) return;
  if (collection === "settings" && !isSyncableSettingKey(docId)) return;
  await coalesceOutbox(collection, docId, "upsert");
  notifyOutboxChange();
}

export async function enqueueDelete(
  collection: SyncCollection,
  docId: string,
): Promise<void> {
  if (suppressOutbox > 0) return;
  if (collection === "settings" && !isSyncableSettingKey(docId)) return;
  await coalesceOutbox(collection, docId, "delete");
  notifyOutboxChange();
}

async function coalesceOutbox(
  collection: SyncCollection,
  docId: string,
  op: SyncOutboxEntry["op"],
): Promise<void> {
  await db.syncOutbox.where("[collection+docId]").equals([collection, docId]).delete();
  await db.syncOutbox.add({
    collection,
    docId,
    op,
    updatedAt: new Date().toISOString(),
  });
}

/** Enqueue every local syncable row (first login / claim existing history). */
export async function enqueueAllLocal(): Promise<void> {
  for (const collection of SYNC_COLLECTIONS) {
    const table = tableFor(collection);
    const rows = (await table.toArray()) as Record<string, unknown>[];
    for (const row of rows) {
      const docId = primaryKeyFor(collection, row);
      if (collection === "settings" && !isSyncableSettingKey(docId)) continue;
      await coalesceOutbox(collection, docId, "upsert");
    }
  }
  notifyOutboxChange();
}
