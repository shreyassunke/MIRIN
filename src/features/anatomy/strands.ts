import type { FiberType } from "./types";

export const STRAND_COUNT = 200;
/** Above this, FiberStrands draws on canvas instead of one SVG path per strand. */
export const CANVAS_STRAND_LIMIT = 600;

export type Point = [number, number];

export interface Strand {
  type: FiberType;
  /** On when this type's recruitment is greater than rank. */
  rank: number;
  /** Head this strand sits in, when the outline is split. */
  head: string | null;
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

function chain(ring: Point[], from: number, to: number): Point[] {
  const out: Point[] = [];
  for (let i = from; i !== to; i = (i + 1) % ring.length) {
    out.push(ring[i]);
    if (out.length > ring.length) break;
  }
  out.push(ring[to]);
  return out;
}

function polylineLength(points: Point[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return length;
}

/** Point at a fraction of the arc length, 0 at the first vertex and 1 at the last. */
function pointAt(points: Point[], u: number): Point {
  const total = polylineLength(points);
  if (total < 1 || points.length === 0) return points[0] ?? [0, 0];
  let walked = 0;
  const target = clamp(u, 0, 1) * total;
  for (let i = 1; i < points.length; i++) {
    const step = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    if (walked + step >= target || i === points.length - 1) {
      const t = step > 0 ? (target - walked) / step : 0;
      return lerp(points[i - 1], points[i], clamp(t, 0, 1));
    }
    walked += step;
  }
  return points[points.length - 1];
}

/**
 * A radiated muscle: the short lateral arc is the tendon, and the rest of
 * the border is the origin. Both arcs run from the same corner to the same
 * corner, so pairing by arc length does not cross.
 */
export function attachmentArcs(ring: Point[]): { origin: Point[]; insertion: Point[] } | null {
  if (ring.length < 4) return null;
  let pole = 0;
  let minX = ring[0][0];
  let maxX = ring[0][0];
  for (let i = 1; i < ring.length; i++) {
    if (ring[i][0] > maxX) {
      maxX = ring[i][0];
      pole = i;
    }
    if (ring[i][0] < minX) minX = ring[i][0];
  }
  const cut = maxX - (maxX - minX) * 0.1;
  const count = ring.length;
  let lo = pole;
  let hi = pole;
  while (ring[(lo - 1 + count) % count][0] >= cut) {
    const next = (lo - 1 + count) % count;
    if (next === hi) break;
    lo = next;
  }
  while (ring[(hi + 1) % count][0] >= cut) {
    const next = (hi + 1) % count;
    if (next === lo) break;
    hi = next;
  }
  const insertion = chain(ring, lo, hi);
  const origin = chain(ring, hi, lo);
  if (polylineLength(insertion) > polylineLength(origin)) return null;
  origin.reverse();
  return { origin, insertion };
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

function centroid(ring: Point[]): Point {
  let twice = 0;
  let x = 0;
  let y = 0;
  for (let i = 0; i < ring.length; i++) {
    const next = ring[(i + 1) % ring.length];
    const cross = ring[i][0] * next[1] - next[0] * ring[i][1];
    twice += cross;
    x += (ring[i][0] + next[0]) * cross;
    y += (ring[i][1] + next[1]) * cross;
  }
  if (Math.abs(twice) < 1e-6) return ring[0] ?? [0, 0];
  return [x / (3 * twice), y / (3 * twice)];
}

function fanCurve(from: Point, to: Point, center: Point, bow: number, ring: Point[]): Point[] {
  const mid = lerp(from, to, 0.5);
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = Math.hypot(dx, dy) || 1;
  const px = -dy / length;
  const py = dx / length;
  const sign = px * (center[0] - mid[0]) + py * (center[1] - mid[1]) >= 0 ? 1 : -1;
  const control: Point = [mid[0] + px * sign * bow, mid[1] + py * sign * bow];
  const bowed = contains(ring, control, 2);
  const steps = [0, 0.22, 0.5, 0.78, 1];
  return steps.map((t) => {
    if (!bowed) return lerp(from, to, t);
    const u = 1 - t;
    return [
      u * u * from[0] + 2 * u * t * control[0] + t * t * to[0],
      u * u * from[1] + 2 * u * t * control[1] + t * t * to[1],
    ];
  });
}

function headAt(point: Point, heads: { id: string; ring: Point[] }[]): string | null {
  let found: string | null = null;
  let area = Infinity;
  for (const head of heads) {
    if (!pointInRing(head.ring, point)) continue;
    const size = Math.abs(
      head.ring.reduce((sum, corner, index) => {
        const next = head.ring[(index + 1) % head.ring.length];
        return sum + corner[0] * next[1] - next[0] * corner[1];
      }, 0),
    );
    if (size < area) {
      area = size;
      found = head.id;
    }
  }
  return found;
}

/**
 * Fascicles of a radiated muscle. Each runs from the long origin border to
 * the short lateral tendon, in order, so neighbours do not cross.
 * The scatter of type and bow is seeded by muscle id.
 */
function fanRing(
  muscleId: string,
  ring: Point[],
  heads: { id: string; ring: Point[] }[],
  ratio: Record<FiberType, number>,
  count: number,
): Strand[] {
  const arcs = attachmentArcs(ring);
  if (!arcs || count <= 0) return [];
  const rng = mulberry32(seedFrom(muscleId));
  const types = mixTypes(count, ratio, rng);
  const ranks = new Map<FiberType, number>([
    ["I", 0],
    ["IIa", 0],
    ["IIx", 0],
  ]);
  const totals = { I: 0, IIa: 0, IIx: 0 };
  for (const type of types) totals[type] += 1;
  const center = centroid(ring);
  const strands: Strand[] = [];
  for (let i = 0; i < count; i++) {
    const type = types[i] ?? "I";
    const seen = ranks.get(type) ?? 0;
    ranks.set(type, seen + 1);
    const u = (i + 0.5) / count;
    const from = pointAt(arcs.origin, 0.02 + u * 0.96);
    const to = pointAt(arcs.insertion, 0.12 + u * 0.76);
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    if (length < 8) continue;
    const bow = length * (0.045 + rng() * 0.03);
    const points = fanCurve(from, to, center, bow, ring).filter((point) =>
      contains(ring, point, 3),
    );
    if (points.length < 2) continue;
    const total = totals[type] || 1;
    const mid = points[Math.floor(points.length / 2)];
    strands.push({
      type,
      rank: seen / total,
      head: headAt(mid, heads),
      points,
    });
  }
  return strands;
}

export function generateStrands(args: {
  muscleId: string;
  ring: Point[];
  heads?: { id: string; ring: Point[] }[];
  ratio: Record<FiberType, number>;
  /** Per-head composition. Geometry stays on `ratio`; only the ink changes. */
  headRatios?: Readonly<Record<string, Record<FiberType, number>>>;
  count?: number;
}): Strand[] {
  const count = args.count ?? STRAND_COUNT;
  const heads = args.heads ?? [];
  const strands = fanRing(args.muscleId, args.ring, heads, args.ratio, count);
  // A separate belly the union fan never crosses (the two forearm muscles)
  // still gets fascicles. A head already inside the outline keeps only the
  // strands that stay in that outline.
  for (const head of heads) {
    const placed = strands.filter((strand) => strand.head === head.id).length;
    if (placed >= 4) continue;
    const extra = fanRing(`${args.muscleId}:${head.id}`, head.ring, [head], args.ratio, count);
    const home = centroid(head.ring);
    if (!contains(args.ring, home, 6)) {
      strands.push(...extra);
      continue;
    }
    const kept = extra.filter((strand) =>
      strand.points.every((point) => contains(args.ring, point, 4)),
    );
    strands.push(...(kept.length >= 4 ? kept : extra));
  }
  if (args.headRatios) applyHeadRatios(strands, args.muscleId, args.ratio, args.headRatios);
  return strands;
}

/** Recolour each head from its own pool. A separate seed leaves the curves put. */
function applyHeadRatios(
  strands: Strand[],
  muscleId: string,
  fallback: Record<FiberType, number>,
  headRatios: Readonly<Record<string, Record<FiberType, number>>>,
) {
  const groups = new Map<string, Strand[]>();
  for (const strand of strands) {
    const key = strand.head ?? "";
    const list = groups.get(key) ?? [];
    list.push(strand);
    groups.set(key, list);
  }
  for (const [head, group] of groups) {
    const ratio = headRatios[head] ?? fallback;
    const types = mixTypes(group.length, ratio, mulberry32(seedFrom(`${muscleId}:${head}`)));
    const seen = new Map<FiberType, number>([
      ["I", 0],
      ["IIa", 0],
      ["IIx", 0],
    ]);
    const totals = { I: 0, IIa: 0, IIx: 0 };
    for (const type of types) totals[type] += 1;
    group.forEach((strand, index) => {
      const type = types[index] ?? "I";
      const count = seen.get(type) ?? 0;
      seen.set(type, count + 1);
      strand.type = type;
      strand.rank = count / (totals[type] || 1);
    });
  }
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
