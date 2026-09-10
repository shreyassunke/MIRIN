// Validates src/data/formVideos.json against the built exercise library and
// reports curation coverage. Run after editing the file by hand:
// `npm run verify:form-videos`.
import {
  CREATOR_IDS,
  VIDEO_ID,
  loadClips,
  loadLibraryIds,
} from "./form-videos.mjs";

/** The curation goal: major compounds plus common accessories. */
const COVERAGE_TARGET = 100;

const clips = loadClips();
const libraryIds = loadLibraryIds();
const errors = [];

for (const [exerciseId, entries] of Object.entries(clips)) {
  const at = (i) => `${exerciseId}[${i}]`;

  if (!libraryIds.has(exerciseId)) {
    errors.push(`${exerciseId}: not an id in src/data/exercises.json`);
  }
  if (!Array.isArray(entries)) {
    errors.push(`${exerciseId}: expected an array of clips`);
    continue;
  }
  if (entries.length === 0) {
    errors.push(`${exerciseId}: empty clip list, drop the key instead`);
  }

  const seen = new Set();
  entries.forEach((clip, i) => {
    if (!VIDEO_ID.test(clip.videoId ?? "")) {
      errors.push(`${at(i)}: "${clip.videoId}" is not an 11-character video id`);
    }
    if (!CREATOR_IDS.includes(clip.creator)) {
      errors.push(`${at(i)}: unknown creator "${clip.creator}"`);
    }
    if (clip.label !== undefined && typeof clip.label !== "string") {
      errors.push(`${at(i)}: label must be a string`);
    }

    for (const key of ["start", "end"]) {
      const value = clip[key];
      if (value === undefined) continue;
      if (!Number.isInteger(value) || value < 0) {
        errors.push(`${at(i)}: ${key} must be a whole number of seconds`);
      }
    }
    if (
      Number.isInteger(clip.start) &&
      Number.isInteger(clip.end) &&
      clip.end <= clip.start
    ) {
      errors.push(`${at(i)}: end (${clip.end}s) must come after start (${clip.start}s)`);
    }

    const key = `${clip.videoId}@${clip.start ?? 0}`;
    if (seen.has(key)) errors.push(`${at(i)}: duplicate of an earlier clip`);
    seen.add(key);

    const unknown = Object.keys(clip).filter(
      (k) => !["videoId", "creator", "label", "start", "end"].includes(k),
    );
    if (unknown.length) {
      errors.push(`${at(i)}: unexpected field(s) ${unknown.join(", ")}`);
    }
  });
}

// One video attributed to two creators means one of them is wrong.
const creatorByVideo = new Map();
for (const [exerciseId, entries] of Object.entries(clips)) {
  for (const clip of entries ?? []) {
    const prior = creatorByVideo.get(clip.videoId);
    if (prior && prior.creator !== clip.creator) {
      errors.push(
        `${exerciseId}: video ${clip.videoId} is "${clip.creator}" here but ` +
          `"${prior.creator}" in ${prior.exerciseId}`,
      );
    }
    creatorByVideo.set(clip.videoId, { creator: clip.creator, exerciseId });
  }
}

if (errors.length) {
  console.error(`formVideos.json has ${errors.length} problem(s):`);
  for (const error of errors) console.error(`  ${error}`);
  process.exit(1);
}

const all = Object.values(clips).flat();
const timestamped = all.filter((c) => c.start !== undefined).length;
const covered = Object.keys(clips).length;

console.log(
  `${covered} exercise(s) covered of ${COVERAGE_TARGET} target ` +
    `(${Math.round((covered / COVERAGE_TARGET) * 100)}%).`,
);
console.log(
  `${all.length} clip(s), ${timestamped} timestamped, ` +
    `${all.length - timestamped} playing the whole video.`,
);
console.log(`${creatorByVideo.size} distinct video(s) across ${libraryIds.size} library entries.`);
