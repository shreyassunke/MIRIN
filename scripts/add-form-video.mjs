// Appends a curated form-video clip to src/data/formVideos.json.
//
//   npm run add:form-video -- squat "https://youtu.be/VIDEOID?t=132" \
//     --end 3:34 --label "Bar position and setup" --creator nippard
//
// The start offset comes from the URL's `t` param, so the normal flow is to
// right-click the video at the right moment, "Copy video URL at current time",
// and paste. --end accepts seconds, mm:ss or 2m12s.
import {
  CREATOR_IDS,
  loadClips,
  loadLibraryIds,
  parseSeconds,
  parseStartFromUrl,
  parseVideoId,
  saveClips,
} from "./form-videos.mjs";

const USAGE = `Usage: npm run add:form-video -- <exercise-id> <youtube-url> [options]

Options:
  --start <time>     Override the URL's t= offset
  --end <time>       Where the segment stops
  --label "<text>"   What the segment covers
  --creator <id>     One of: ${CREATOR_IDS.join(", ")}
  --replace          Drop existing clips for this exercise first`;

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const name = arg.slice(2);
    if (name === "replace") {
      flags.replace = true;
      continue;
    }
    const value = argv[++i];
    if (value === undefined) fail(`Missing value for --${name}`);
    flags[name] = value;
  }
  return { positional, flags };
}

function fail(message) {
  console.error(`${message}\n\n${USAGE}`);
  process.exit(1);
}

const { positional, flags } = parseArgs(process.argv.slice(2));
const [exerciseId, url] = positional;
if (!exerciseId || !url) fail("Expected an exercise id and a YouTube URL.");

const libraryIds = loadLibraryIds();
if (!libraryIds.has(exerciseId)) {
  fail(
    `Unknown exercise id "${exerciseId}". Ids come from src/data/exercises.json.`,
  );
}

const videoId = parseVideoId(url);
if (!videoId) fail(`Could not read a video id out of "${url}".`);

const clips = loadClips();

// Reuse the creator already recorded for this video so the same tutorial is
// never attributed two different ways.
const knownCreator = Object.values(clips)
  .flat()
  .find((clip) => clip.videoId === videoId)?.creator;

const creator = flags.creator ?? knownCreator;
if (!creator) {
  fail(
    `This video is new, so --creator is required (${CREATOR_IDS.join(", ")}).`,
  );
}
if (!CREATOR_IDS.includes(creator)) {
  fail(`Unknown creator "${creator}". Expected one of: ${CREATOR_IDS.join(", ")}`);
}
if (knownCreator && flags.creator && flags.creator !== knownCreator) {
  fail(
    `Video ${videoId} is already attributed to "${knownCreator}" elsewhere.`,
  );
}

const start = flags.start ? parseSeconds(flags.start) : parseStartFromUrl(url);
if (flags.start && start === null) fail(`Could not read --start "${flags.start}".`);

const end = flags.end ? parseSeconds(flags.end) : null;
if (flags.end && end === null) fail(`Could not read --end "${flags.end}".`);
if (start !== null && end !== null && end <= start) {
  fail(`--end (${end}s) must come after the start (${start}s).`);
}

const clip = { videoId, creator };
if (flags.label) clip.label = flags.label;
if (start !== null) clip.start = start;
if (end !== null) clip.end = end;

const existing = flags.replace ? [] : (clips[exerciseId] ?? []);
const duplicate = existing.find(
  (c) => c.videoId === videoId && (c.start ?? null) === (start ?? null),
);
if (duplicate) {
  fail(`${exerciseId} already has this video at the same start offset.`);
}

clips[exerciseId] = [...existing, clip];
saveClips(clips);

const segment =
  start === null && end === null
    ? "whole video"
    : `${start ?? 0}s–${end ?? "end"}`;
console.log(
  `Added ${creator} ${videoId} (${segment}) to ${exerciseId}. ` +
    `${clips[exerciseId].length} clip(s) now.`,
);
