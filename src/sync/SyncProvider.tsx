import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "../auth/AuthProvider";
import {
  readSyncState,
  runSync,
  type SyncState,
} from "../lib/sync/engine";
import { onOutboxChange } from "../lib/sync/outbox";
import { isSupabaseConfigured } from "../lib/supabase";

interface SyncContextValue extends SyncState {
  syncNow: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

const DEBOUNCE_MS = 800;
const INTERVAL_MS = 30_000;

export function SyncProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<SyncState>({
    status: isSupabaseConfigured ? "idle" : "disabled",
    lastSyncedAt: null,
    error: null,
  });

  useEffect(() => {
    void readSyncState().then(setState);
  }, []);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) return;

    let cancelled = false;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    let inFlight: Promise<void> | null = null;
    let queued = false;

    const sync = () => {
      if (cancelled) return;
      if (inFlight) {
        queued = true;
        return;
      }
      inFlight = (async () => {
        setState((prev) => ({ ...prev, status: "syncing", error: null }));
        const next = await runSync(user.id);
        if (!cancelled) setState(next);
      })().finally(() => {
        inFlight = null;
        if (queued && !cancelled) {
          queued = false;
          sync();
        }
      });
    };

    const schedule = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(sync, DEBOUNCE_MS);
    };

    sync();
    const unsubscribe = onOutboxChange(schedule);
    const interval = setInterval(sync, INTERVAL_MS);
    const onOnline = () => sync();
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      unsubscribe();
      clearInterval(interval);
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user?.id]);

  const value = useMemo<SyncContextValue>(
    () => ({
      ...state,
      async syncNow() {
        if (!user) return;
        setState((prev) => ({ ...prev, status: "syncing", error: null }));
        setState(await runSync(user.id));
      },
    }),
    [state, user],
  );

  return (
    <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
  );
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) {
    throw new Error("useSync must be used within SyncProvider");
  }
  return ctx;
}
