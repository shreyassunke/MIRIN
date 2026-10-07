/**
 * Fibre classes in recruitment order. Henneman's size principle: a muscle
 * recruits its low-threshold units first and reaches the high-threshold ones
 * only as force demand or fatigue climbs. Type I goes before IIa before IIx.
 */
export type FiberClass = "I" | "IIa" | "IIx";

export const FIBER_CLASSES: FiberClass[] = ["I", "IIa", "IIx"];

export const FIBER_CLASS_LABEL: Record<FiberClass, string> = {
  I: "Type I",
  IIa: "Type IIa",
  IIx: "Type IIx",
};

/** One sentence each, for the legend note. Facts only, in recruitment order. */
export const FIBER_CLASS_NOTE: Record<FiberClass, string> = {
  I: "Slow fibres. They come in first and stay on from the opening rep.",
  IIa: "Faster fibres. They join once the slow ones can't cover the load.",
  IIx: "The fastest fibres. Reached only under a heavy load, or once the others fatigue.",
};

/** Cumulative share of the pool at the top of each class. */
export function fiberEdges(slowShare: number): Record<FiberClass, number> {
  const fast = 1 - slowShare;
  return { I: slowShare, IIa: slowShare + fast * 0.66, IIx: 1 };
}

export function classAt(
  threshold: number,
  edges: Record<FiberClass, number>,
): FiberClass {
  if (threshold < edges.I) return "I";
  if (threshold < edges.IIa) return "IIa";
  return "IIx";
}

/**
 * What a set does to the pool. Two levels matter, and progressive overload
 * only moves the first:
 *
 * - `onset` is the share recruited from the opening rep, set by how heavy the
 *   load is. A heavier load puts more of the pool to work for the whole set —
 *   this is the number an added increment actually raises.
 * - `ceiling` is the share the set reaches by its last rep, once fatigue in
 *   the low-threshold units forces higher-threshold ones in. A light set
 *   carried to failure gets here too; it just arrives late.
 */
export interface Recruitment {
  onset: number;
  ceiling: number;
  /** Prescribed load over the estimated 1RM. */
  intensity: number;
  /** Estimated reps left in reserve at this load and rep target. */
  rir: number;
  /** Deepest class working from the opening rep. */
  deepest: FiberClass | null;
  /** Deepest class the set reaches at all. */
  touched: FiberClass | null;
  edges: Record<FiberClass, number>;
}

/**
 * Motor-unit counts are distributed exponentially — many small units each
 * carrying little force — so the share of the pool recruited runs ahead of
 * the share of the force produced. This exponent shapes that curve.
 */
const POOL_CURVE = 0.85;
/** Reps in reserve past this and fatigue has forced nothing extra in. */
const RIR_SPAN = 5;

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

/** Share of the pool recruited at one instant's force demand. */
const share = (effort: number) => clamp(effort, 0, 1) ** POOL_CURVE;

export function recruitmentFor(args: {
  /** Display units; either side of the ratio works as long as both match. */
  weight: number;
  reps: number;
  /** Estimated 1RM in the same units. 0 when the lift carries no load. */
  e1rm: number;
  slowShare: number;
  /** Top of the working range, used when there is no 1RM to measure against. */
  repMax: number;
}): Recruitment {
  const edges = fiberEdges(args.slowShare);
  const loaded = args.e1rm > 0 && args.weight > 0;
  const intensity = loaded
    ? clamp(args.weight / args.e1rm, 0, 1)
    : clamp(args.reps / (args.repMax + 4), 0, 1);
  // Epley inverted: the most reps this load should allow.
  const ceilingReps = loaded ? 30 * (args.e1rm / args.weight - 1) : args.repMax;
  const rir = Math.max(0, ceilingReps - args.reps);
  // How far into failure the set is carried. At RIR 0 the last rep is maximal.
  const completion = clamp(1 - rir / RIR_SPAN, 0, 1);
  const onset = share(intensity);
  const ceiling = share(intensity + (1 - intensity) * completion);
  return {
    onset,
    ceiling,
    intensity,
    rir: Math.round(rir * 10) / 10,
    deepest: onset <= 0 ? null : classAt(Math.min(onset, 0.9999), edges),
    touched: ceiling <= 0 ? null : classAt(Math.min(ceiling, 0.9999), edges),
    edges,
  };
}
