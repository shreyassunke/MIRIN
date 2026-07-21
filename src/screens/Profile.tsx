import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthProvider";
import { getContactLine, getDisplayName } from "../lib/user";
import { useSync } from "../sync/SyncProvider";

const inputClass =
  "h-12 w-full rounded-md border border-hairline bg-bg px-3 text-base text-ink placeholder:text-muted transition-colors duration-150 focus:border-muted";
const primaryBtn =
  "btn-primary h-12 rounded-pill bg-accent px-5 text-sm font-medium text-bg hover:bg-ink disabled:opacity-40";
const secondaryBtn =
  "glass-btn h-12 rounded-pill px-5 text-sm font-medium text-ink";

function syncLabel(status: string, lastSyncedAt: string | null): string {
  switch (status) {
    case "syncing":
      return "Syncing…";
    case "offline":
      return "Offline — changes stay on this device until you reconnect.";
    case "error":
      return "Sync paused — will retry automatically.";
    case "disabled":
      return "Cloud sync is not configured.";
    case "synced":
      return lastSyncedAt
        ? `Last synced ${formatSyncTime(lastSyncedAt)}.`
        : "Synced.";
    default:
      return lastSyncedAt
        ? `Last synced ${formatSyncTime(lastSyncedAt)}.`
        : "Waiting to sync.";
  }
}

function formatSyncTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function Profile() {
  const { user, updateDisplayName, signOut } = useAuth();
  const { status, lastSyncedAt, error: syncError, syncNow } = useSync();
  const [name, setName] = useState(() => getDisplayName(user));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setName(getDisplayName(user));
  }, [user]);

  const contact = getContactLine(user);
  const displayName = getDisplayName(user);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSubmitting(true);
    try {
      const result = await updateDisplayName(name);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
      <p className="mt-2 max-w-[65ch] text-[15px] leading-relaxed text-muted">
        Name and account details for this log.
      </p>

      <section className="mt-8 rounded-xl glass p-4 md:p-6">
        <p className="text-[15px] font-semibold tracking-tight">
          {displayName || "No name set"}
        </p>
        {contact ? (
          <p className="mt-1 text-[13px] text-muted">{contact}</p>
        ) : null}
      </section>

      <section className="mt-6">
        <h2 className="text-[13px] font-medium text-muted">Cloud sync</h2>
        <p className="mt-1.5 text-[15px] leading-relaxed text-ink" role="status">
          {syncLabel(status, lastSyncedAt)}
        </p>
        {syncError ? (
          <p className="mt-1 text-[13px] leading-relaxed text-muted" role="alert">
            {syncError}
          </p>
        ) : null}
        <button
          type="button"
          className={`${secondaryBtn} mt-3`}
          onClick={() => void syncNow()}
          disabled={status === "syncing" || status === "disabled"}
        >
          {status === "syncing" ? "Syncing…" : "Sync now"}
        </button>
      </section>

      <form className="mt-8 flex flex-col gap-4" onSubmit={onSave}>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-muted">Name</span>
          <input
            className={inputClass}
            type="text"
            name="name"
            autoComplete="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
            required
          />
        </label>

        {error ? (
          <p className="text-[13px] leading-relaxed text-ink" role="alert">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p className="text-[13px] leading-relaxed text-muted" role="status">
            Name saved.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button type="submit" className={primaryBtn} disabled={submitting}>
            {submitting ? "Saving…" : "Save name"}
          </button>
          <button
            type="button"
            className={secondaryBtn}
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </div>
      </form>
    </div>
  );
}
