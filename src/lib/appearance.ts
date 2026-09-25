import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";

/** localStorage mirror so the first paint matches the last choice. Keep in sync with index.html. */
export const APPEARANCE_STORAGE_KEY = "mirin.appearance";

const MODE_KEY = "appearance.mode";
/** Retired. Accent stays Chalk; leftover rows are dropped on sync. */
const PALETTE_KEY = "appearance.palette";

export const APPEARANCE_MODES = ["system", "light", "dark"] as const;
export type AppearanceMode = (typeof APPEARANCE_MODES)[number];

export const MODE_LABEL: Record<AppearanceMode, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

const DEFAULT_MODE: AppearanceMode = "dark";

export function parseMode(value: string | null | undefined): AppearanceMode | null {
  return APPEARANCE_MODES.find((mode) => mode === value) ?? null;
}

export function readCachedAppearance(): AppearanceMode {
  try {
    const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (!raw) return DEFAULT_MODE;
    const parsed = JSON.parse(raw) as { mode?: string };
    return parseMode(parsed.mode) ?? DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

export function resolveMode(mode: AppearanceMode): "dark" | "light" {
  if (mode === "light" || mode === "dark") return mode;
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

export function applyAppearance(mode: AppearanceMode) {
  const resolved = resolveMode(mode);
  const root = document.documentElement;
  root.dataset.mode = resolved;
  delete root.dataset.palette;
  root.style.colorScheme = resolved;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", resolved === "light" ? "#f3f2ef" : "#0a0a0a");
}

function cacheAppearance(mode: AppearanceMode) {
  localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify({ mode }));
}

/**
 * Resolved choice. While IndexedDB is loading, the localStorage mirror is
 * what the boot script already painted.
 */
export function useAppearanceChoice(): { mode: AppearanceMode } {
  const modeValue = useLiveQuery(
    async () => (await db.settings.get(MODE_KEY))?.value ?? "",
    [],
    null,
  );
  const cached = readCachedAppearance();
  return {
    mode: modeValue === null ? cached : parseMode(modeValue) ?? DEFAULT_MODE,
  };
}

export function AppearanceSync() {
  const { mode } = useAppearanceChoice();

  useEffect(() => {
    applyAppearance(mode);
    cacheAppearance(mode);
  }, [mode]);

  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => applyAppearance("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  useEffect(() => {
    void db.settings.delete(PALETTE_KEY);
  }, []);

  return null;
}

export async function saveAppearance(mode: AppearanceMode): Promise<void> {
  applyAppearance(mode);
  cacheAppearance(mode);
  await db.settings.put({ key: MODE_KEY, value: mode });
  await db.settings.delete(PALETTE_KEY);
}
