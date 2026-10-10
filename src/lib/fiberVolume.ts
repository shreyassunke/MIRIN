import { classAt, fiberEdges, type FiberClass } from "./fibers";
import { muscleSpec } from "./anatomy";
import type { RegionId } from "./muscleRegions";

export interface VolumeFascicle {
  points: number[];
  threshold: number;
  klass: FiberClass;
  bundle: number;
}

export interface FiberVolume {
  region: RegionId;
  url: string;
  fascicles: VolumeFascicle[];
}

interface VolumeFile {
  fascicles: { b: number; p: number[] }[];
}

const cache = new Map<string, Promise<FiberVolume>>();

function scatter(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function volumeUrl(region: RegionId) {
  return `/models/fibers/${region}.glb`;
}

export function volumeDataUrl(region: RegionId) {
  return `/models/fibers/${region}.json`;
}

/**
 * Fascicles ranked the same way as the 2D plate: Johnson's mosaic, emphasised
 * bundle first, thresholds normalised to the pool so onset/ceiling light
 * exactly that share.
 */
export function loadFiberVolume(
  region: RegionId,
  emphasis: number,
): Promise<FiberVolume> {
  const key = `${region}:${emphasis}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const promise = fetch(volumeDataUrl(region))
    .then((res) => {
      if (!res.ok) throw new Error(`fiber volume ${region} missing`);
      return res.json() as Promise<VolumeFile>;
    })
    .then((file) => {
      const spec = muscleSpec(region);
      const edges = fiberEdges(spec.slowShare);
      const raw = file.fascicles;
      const ranked = raw
        .map((fascicle, index) => ({
          index,
          priority:
            fascicle.b === emphasis
              ? scatter(index + 1) * 0.52
              : 0.48 + scatter(index + 1) * 0.52,
        }))
        .sort((a, b) => a.priority - b.priority);

      const fascicles = new Array<VolumeFascicle>(raw.length);
      ranked.forEach((entry, rank) => {
        const threshold = rank / Math.max(1, raw.length - 1);
        fascicles[entry.index] = {
          points: raw[entry.index].p,
          threshold,
          klass: classAt(threshold, edges),
          bundle: raw[entry.index].b,
        };
      });

      return { region, url: volumeUrl(region), fascicles };
    });

  cache.set(key, promise);
  return promise;
}

export function fascicleState(
  threshold: number,
  stageOnset: number,
  onset: number,
  ceiling: number,
): "full" | "gained" | "late" | "idle" {
  const gainSpan = Math.max(0.0001, onset - stageOnset);
  if (threshold < Math.min(onset, stageOnset)) return "full";
  if (threshold >= stageOnset && threshold < onset) {
    void gainSpan;
    return "gained";
  }
  if (threshold < ceiling) return "late";
  return "idle";
}

export function gainDelay(threshold: number, stageOnset: number, onset: number) {
  const gainSpan = Math.max(0.0001, onset - stageOnset);
  if (threshold < stageOnset || threshold >= onset) return 0;
  return Math.round(((threshold - stageOnset) / gainSpan) * 420);
}
