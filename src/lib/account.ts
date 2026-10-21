import { db } from "../db/db";
import { getSupabase } from "./supabase";
import { withSyncSuppressed } from "./sync/outbox";

/** Remove every local row without enqueueing a cloud delete. */
export async function wipeLocalLog(): Promise<void> {
  await withSyncSuppressed(() =>
    db.transaction("rw", db.tables, async () => {
      await Promise.all(db.tables.map((table) => table.clear()));
    }),
  );
}

/**
 * Deletes the Supabase user. sync_documents rows cascade with auth.users.
 * The caller wipes Dexie and signs out after this succeeds.
 */
export async function deleteRemoteAccount(): Promise<{ error: string | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: "Supabase is not configured." };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { error: "A connection is required to delete the account." };
  }
  const { error } = await supabase.functions.invoke("delete-account", {
    method: "POST",
  });
  if (error) return { error: error.message };
  return { error: null };
}
