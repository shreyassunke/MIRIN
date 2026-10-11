import type { FiberType } from "./types";

export const STRAND_COUNT = 200;
/** Above this, FiberStrands draws on canvas instead of one SVG path per strand. */
export const CANVAS_STRAND_LIMIT = 600;

export type Point = [number, number];

export interface Strand {
  type: FiberType;
  /** On when this type's recruitment is greater than rank. */
  rank: number;
  points: Point[];
}

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

/** Stable generator. The same seed always walks the same sequence. */
export function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFrom(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  }
  return hash >>> 0;
}

/** Exporter paths are M/L/Z only. The first ring is the outline. */
export function parseOutline(d: string): Point[] {
  const tokens = d.match(/[MLZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  const ring: Point[] = [];
  let command = "";
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (/[MLZ]/i.test(token)) {
      if (/z/i.test(token) && ring.length > 2) return ring;
      command = token.toUpperCase();
      continue;
    }
    const x = Number(token);
    const y = Number(tokens[++i]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (command === "M" || command === "L") ring.push([x, y]);
  }
  return ring;
}

export function pointInRing(ring: Point[], point: Point): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const crosses = yi > point[1] !== yj > point[1];
    if (!crosses) continue;
    const x = ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
    if (point[0] < x) inside = !inside;
  }
  return inside;
}

function nearRing(ring: Point[], point: Point, pad: number): boolean {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = dx * dx + dy * dy || 1;
    const t = clamp(((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / len, 0, 1);
    const px = a[0] + t * dx - point[0];
    const py = a[1] + t * dy - point[1];
    if (px * px + py * py <= pad * pad) return true;
  }
  return false;
}

export function contains(ring: Point[], point: Point, pad = 1.5): boolean {
  return pointInRing(ring, point) || nearRing(ring, point, pad);
}

function lineHit(origin: Point, dir: Point, a: Point, b: Point): number | null {
  const sx = b[0] - a[0];
  const sy = b[1] - a[1];
  const den = dir[0] * sy - dir[1] * sx;
  if (Math.abs(den) < 1e-8) return null;
  const dx = a[0] - origin[0];
  const dy = a[1] - origin[1];
  const t = (dx * sy - dy * sx) / den;
  const u = (dx * dir[1] - dy * dir[0]) / den;
  if (u < -1e-4 || u > 1 + 1e-4) return null;
  return t;
}

/**
 * The slice of the outline through `origin` along `dir`.
 * A grazing notch (the lateral tendon step) is joined back into one span
 * so a fiber does not jump across a one-pixel gap. Larger gaps stay open.
 */
function chord(ring: Point[], origin: Point, dir: Point): [Point, Point] | null {
  const hits: number[] = [];
  for (let i = 0; i < ring.length; i++) {
    const t = lineHit(origin, dir, ring[i], ring[(i + 1) % ring.length]);
    if (t == null) continue;
    if (hits.length === 0 || Math.abs(t - hits[hits.length - 1]) > 0.4) hits.push(t);
  }
  hits.sort((a, b) => a - b);
  const unique = hits.filter((t, i) => i === 0 || t - hits[i - 1] > 0.4);
  const spans: [number, number][] = [];
  for (let i = 0; i + 1 < unique.length; i += 2) spans.push([unique[i], unique[i + 1]]);
  if (spans.length === 0) return null;
  const extent = unique[unique.length - 1] - unique[0];
  const join = Math.max(12, extent * 0.08);
  const merged: [number, number][] = [[spans[0][0], spans[0][1]]];
  for (let i = 1; i < spans.length; i++) {
    const prev = merged[merged.length - 1];
    if (spans[i][0] - prev[1] <= join) prev[1] = Math.max(prev[1], spans[i][1]);
    else merged.push([spans[i][0], spans[i][1]]);
  }
  let best = merged[0];
  let bestDist = Infinity;
  for (const span of merged) {
    const containsOrigin = span[0] <= 0.4 && span[1] >= -0.4;
    const dist = containsOrigin ? 0 : Math.min(Math.abs(span[0]), Math.abs(span[1]));
    if (dist < bestDist) {
      best = span;
      bestDist = dist;
    }
  }
  const at = (t: number): Point => [origin[0] + dir[0] * t, origin[1] + dir[1] * t];
  return [at(best[0]), at(best[1])];
}

function lerp(a: Point, b: Point, t: number): Point {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function mixTypes(count: number, ratio: Record<FiberType, number>, rng: () => number): FiberType[] {
  const weight = ratio.I + ratio.IIa + ratio.IIx;
  const scale = weight > 0 ? weight : 1;
  const types: FiberType[] = [];
  const push = (type: FiberType, n: number) => {
    for (let i = 0; i < n; i++) types.push(type);
  };
  const nI = Math.round((count * ratio.I) / scale);
  const nIIa = Math.round((count * ratio.IIa) / scale);
  push("I", nI);
  push("IIa", nIIa);
  push("IIx", Math.max(0, count - types.length));
  while (types.length > count) types.pop();
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }
  return types;
}

/**
 * Strands fan from the origin side of the outline to the insertion side.
 * Each one follows the outline's width, so a tapering head converges.
 * The scatter is seeded by muscle id.
 */
export function generateStrands(args: {
  muscleId: string;
  ring: Point[];
  origin: Point;
  insertion: Point;
  ratio: Record<FiberType, number>;
  count?: number;
}): Strand[] {
  const { ring, origin, insertion } = args;
  const count = args.count ?? STRAND_COUNT;
  if (ring.length < 3 || count <= 0) return [];
  const rng = mulberry32(seedFrom(args.muscleId));
  const axis: Point = [insertion[0] - origin[0], insertion[1] - origin[1]];
  const length = Math.hypot(axis[0], axis[1]);
  if (length < 1) return [];
  const dir: Point = [axis[0] / length, axis[1] / length];
  const perp: Point = [-dir[1], dir[0]];
  const types = mixTypes(count, args.ratio, rng);
  const ranks = new Map<FiberType, number>([
    ["I", 0],
    ["IIa", 0],
    ["IIx", 0],
  ]);
  const totals = { I: 0, IIa: 0, IIx: 0 };
  for (const type of types) totals[type] += 1;

  let minAlong = Infinity;
  let maxAlong = -Infinity;
  for (const point of ring) {
    const t = (point[0] - origin[0]) * dir[0] + (point[1] - origin[1]) * dir[1];
    if (t < minAlong) minAlong = t;
    if (t > maxAlong) maxAlong = t;
  }
  const span = maxAlong - minAlong;
  const inset = clamp(span * 0.02, 4, span * 0.08);
  const stations = [0, 0.14, 0.3, 0.5, 0.7, 0.86, 1].map(
    (u) => minAlong + inset + (span - inset * 2) * u,
  );
  const slices = stations.map((t) => {
    const at: Point = [origin[0] + dir[0] * t, origin[1] + dir[1] * t];
    return chord(ring, at, perp);
  });

  const strands: Strand[] = [];
  for (let i = 0; i < count; i++) {
    const type = types[i] ?? "I";
    const seen = ranks.get(type) ?? 0;
    ranks.set(type, seen + 1);
    const u = clamp((i + 0.5) / count + (rng() - 0.5) * 0.03, 0.04, 0.96);
    const bow = (rng() - 0.5) * length * 0.035;
    const points: Point[] = [];
    slices.forEach((slice, index) => {
      if (!slice) return;
      const along = lerp(slice[0], slice[1], u);
      const point = lerp(along, [along[0] + perp[0] * bow, along[1] + perp[1] * bow], index === 2 ? 1 : 0.35);
      points.push(contains(ring, point, 2) ? point : along);
    });
    if (points.length < 2) continue;
    const total = totals[type] || 1;
    strands.push({ type, rank: seen / total, points });
  }
  return strands;
}

export function strandPath(strand: Strand): string {
  const [first, ...rest] = strand.points;
  if (!first) return "";
  const head = `M ${first[0].toFixed(2)} ${first[1].toFixed(2)}`;
  const tail = rest.map((point) => `L ${point[0].toFixed(2)} ${point[1].toFixed(2)}`).join(" ");
  return `${head} ${tail}`;
}

export function strandOn(strand: Strand, recruitment: Record<FiberType, number>): boolean {
  const level = recruitment[strand.type];
  if (!Number.isFinite(level) || level <= 0) return false;
  return strand.rank < level;
}
