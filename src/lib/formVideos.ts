import clipsByExercise from "../data/formVideos.json";

/**
 * Curated deep-links into form tutorials, keyed by exercise library id.
 *
 * The data is committed rather than fetched: YouTube's Data API has never
 * exposed chapter markers, so segment boundaries are hand-authored via
 * `npm run add:form-video`. Playback itself needs a connection — no source
 * permits caching the media — so this is an online-only enhancement layered
 * over the otherwise-offline app.
 */
export type CreatorId = "nippard" | "athleanx" | "plitt";

export interface FormClip {
  videoId: string;
  creator: CreatorId;
  /** What this segment covers, e.g. "Bar position and setup". */
  label?: string;
  /** Second offsets. Omit both to play the whole video. */
  start?: number;
  end?: number;
}

export interface Creator {
  name: string;
  channelUrl: string;
}

export const CREATORS: Record<CreatorId, Creator> = {
  nippard: {
    name: "Jeff Nippard",
    channelUrl: "https://www.youtube.com/@JeffNippard",
  },
  athleanx: {
    name: "ATHLEAN-X",
    channelUrl: "https://www.youtube.com/@athleanx",
  },
  plitt: {
    name: "Greg Plitt",
    channelUrl: "https://www.youtube.com/channel/UCU6WaCIOCL_eToBcsBYFwAQ",
  },
};

export const CREATOR_IDS = Object.keys(CREATORS) as CreatorId[];

const byExercise: Record<string, FormClip[]> = clipsByExercise;

export const formClipsFor = (exerciseId: string): FormClip[] =>
  byExercise[exerciseId] ?? [];

/**
 * Privacy-enhanced host so nothing is stored until the user actually plays.
 * `playsinline` keeps iOS from taking over the screen mid-workout.
 */
export const embedUrl = (clip: FormClip): string => {
  const params = new URLSearchParams({
    rel: "0",
    playsinline: "1",
    modestbranding: "1",
  });
  if (clip.start !== undefined) params.set("start", String(clip.start));
  if (clip.end !== undefined) params.set("end", String(clip.end));
  return `https://www.youtube-nocookie.com/embed/${clip.videoId}?${params}`;
};

const mmss = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};

/** The segment a clip covers, or null when it plays the whole video. */
export const segmentLabel = (clip: FormClip): string | null => {
  const { start, end } = clip;
  if (start === undefined && end === undefined) return null;
  if (end === undefined) return `From ${mmss(start!)}`;
  if (start === undefined) return `First ${mmss(end)}`;
  return `${mmss(start)}–${mmss(end)}`;
};
