// Shared helpers for the form-video authoring and verification scripts.
// Kept in sync by hand with src/lib/formVideos.ts (CREATOR_IDS) and
// src/data/formVideos.d.json.ts (clip shape); verify-form-videos.mjs is what
// catches drift in the data itself.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export const CLIPS_PATH = join(ROOT, "src", "data", "formVideos.json");
export const LIBRARY_PATH = join(ROOT, "src", "data", "exercises.json");

export const CREATOR_IDS = ["nippard", "athleanx", "plitt"];

/** YouTube ids are exactly 11 url-safe base64 characters. */
export const VIDEO_ID = /^[\w-]{11}$/;

export const loadClips = () => JSON.parse(readFileSync(CLIPS_PATH, "utf8"));

export const loadLibraryIds = () =>
  new Set(JSON.parse(readFileSync(LIBRARY_PATH, "utf8")).map((e) => e.id));

/** Stable on-disk shape: exercise keys sorted, clips ordered by start. */
export function saveClips(clips) {
  const sorted = {};
  for (const id of Object.keys(clips).sort()) {
    sorted[id] = [...clips[id]].sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
  }
  writeFileSync(CLIPS_PATH, `${JSON.stringify(sorted, null, 2)}\n`);
}

/**
 * Accepts the forms YouTube's share sheet produces: youtu.be/ID,
 * watch?v=ID, /embed/ID and /shorts/ID.
 */
export function parseVideoId(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return VIDEO_ID.test(url) ? url : null;
  }

  if (parsed.hostname.endsWith("youtu.be")) {
    const id = parsed.pathname.slice(1);
    return VIDEO_ID.test(id) ? id : null;
  }

  const v = parsed.searchParams.get("v");
  if (v && VIDEO_ID.test(v)) return v;

  const match = parsed.pathname.match(/\/(?:embed|shorts|v)\/([\w-]{11})/);
  return match ? match[1] : null;
}

/** "132", "132s", "2m12s" and "1h2m3s" all mean seconds from the start. */
export function parseSeconds(value) {
  if (value === null || value === undefined || value === "") return null;

  const raw = String(value).trim();
  if (/^\d+$/.test(raw)) return Number(raw);

  const colons = raw.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
  if (colons) {
    const [, h, m, s] = colons;
    return Number(h ?? 0) * 3600 + Number(m) * 60 + Number(s);
  }

  const units = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (units && units.slice(1).some(Boolean)) {
    const [, h, m, s] = units;
    return Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0);
  }

  return null;
}

/** The `t` / `start` param on a share link, if present. */
export function parseStartFromUrl(url) {
  try {
    const parsed = new URL(url);
    return parseSeconds(
      parsed.searchParams.get("t") ?? parsed.searchParams.get("start"),
    );
  } catch {
    return null;
  }
}
