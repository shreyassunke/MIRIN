import {
  ATLAS_REGIONS,
  BACK_PATHS,
  FRONT_PATHS,
  type AtlasView,
} from "./anatomy.generated";
import { classAt, fiberEdges, type FiberClass } from "./fibers";
import type { RegionId } from "./muscleRegions";

/**
 * Fascicle geometry is derived from the muscle's own outline rather than
 * drawn beside it: rule curves are laid across the belly at the measured
 * pennation angle, then trimmed to the part that falls inside the real
 * silhouette. A fascicle therefore starts and ends on the muscle's border.
 *
 * Pennation angle and fascicle-to-muscle-length ratio are measured values.
 * Lower limb: Ward, Eng, Smallwood & Lieber, "Are current measurements of
 * lower extremity muscle architecture accurate?", Clin Orthop Relat Res 2009
 * (27 muscles, 21 limbs). Upper limb: Charles et al., "Upper and Lower Limb
 * Muscle Architecture of a 104 Year-Old Cadaver", PLOS ONE 2016. Where that
 * specimen reports 0° for a muscle known to be pennate, the standard
 * anatomical range is used instead and marked.
 */

type Point = [number, number];

/** How the fascicles sit relative to the muscle's line of pull. */
type Architecture =
  /** Converging from a broad origin onto a short tendon, given as a segment. */
  | { kind: "fan"; tendon: [Point, Point] }
  /** Running the length of the belly. */
  | { kind: "parallel" }
  /** Oblique to the line of pull. `both` draws the bipennate mirror. */
  | { kind: "pennate"; both?: boolean };

interface BundleSpec {
  label: string;
  /** Atlas outline, where the atlas draws this bundle on its own. */
  path?: string;
  /** Degrees between fascicle and line of pull. */
  pennation: number;
  /** Fascicle length over muscle length; short values pack the belly. */
  lfLm: number;
  architecture: Architecture;
}

export interface MuscleSpec {
  label: string;
  /** The bundle a plain version of the lift leans on. */
  mainBundle: number;
  /** Type I share of this muscle's pool (Johnson et al. 1973, and after). */
  slowShare: number;
  bundles: BundleSpec[];
}

const fan = (a: Point, b: Point): Architecture => ({ kind: "fan", tendon: [a, b] });
const parallel: Architecture = { kind: "parallel" };
const pennate: Architecture = { kind: "pennate" };
const bipennate: Architecture = { kind: "pennate", both: true };

export const MUSCLES: Record<RegionId, MuscleSpec> = {
  chest: {
    label: "Pectoralis major",
    mainBundle: 1,
    slowShare: 0.42,
    bundles: [
      { label: "clavicular", pennation: 0, lfLm: 0.42, architecture: fan([430, 214], [436, 300]) },
      { label: "sternal", pennation: 0, lfLm: 0.46, architecture: fan([430, 214], [436, 300]) },
      { label: "abdominal", pennation: 0, lfLm: 0.44, architecture: fan([430, 214], [436, 300]) },
    ],
  },
  lats: {
    label: "Latissimus",
    mainBundle: 1,
    slowShare: 0.5,
    bundles: [
      { label: "costal", pennation: 0, lfLm: 0.86, architecture: fan([168, 276], [160, 314]) },
      { label: "vertebral", pennation: 0, lfLm: 0.86, architecture: fan([168, 276], [160, 314]) },
      { label: "iliac", pennation: 0, lfLm: 0.86, architecture: fan([168, 276], [160, 314]) },
    ],
  },
  traps: {
    label: "Trapezius",
    mainBundle: 1,
    slowShare: 0.54,
    bundles: [
      { label: "upper", pennation: 0, lfLm: 0.9, architecture: fan([158, 152], [182, 220]) },
      { label: "middle", pennation: 0, lfLm: 0.9, architecture: fan([158, 152], [182, 220]) },
      { label: "lower", pennation: 0, lfLm: 0.9, architecture: fan([158, 152], [182, 220]) },
    ],
  },
  glutes: {
    // Ward 2009: 21.9°, Lf/Lm 0.62 — long fibres for a muscle this size.
    label: "Gluteus maximus",
    mainBundle: 1,
    slowShare: 0.52,
    bundles: [
      { label: "upper", pennation: 0, lfLm: 0.62, architecture: fan([182, 566], [190, 628]) },
      { label: "middle", pennation: 0, lfLm: 0.62, architecture: fan([182, 566], [190, 628]) },
      { label: "lower", pennation: 0, lfLm: 0.62, architecture: fan([182, 566], [190, 628]) },
    ],
  },
  triceps: {
    // PLOS 2016 reads 0° on this elderly specimen; the heads are unipennate,
    // so the standard range is used.
    label: "Triceps",
    mainBundle: 1,
    slowShare: 0.33,
    bundles: [
      {
        label: "lateral head",
        path: "triceps_brachii_caput_laterale_l",
        pennation: 15,
        lfLm: 0.25,
        architecture: pennate,
      },
      {
        label: "long head",
        path: "triceps_brachii_caput_longum_l",
        pennation: 12,
        lfLm: 0.3,
        architecture: pennate,
      },
      {
        label: "medial head",
        path: "triceps_brachii_caput_mediale_l",
        pennation: 20,
        lfLm: 0.3,
        architecture: pennate,
      },
    ],
  },
  "front-delt": {
    // PLOS 2016: anterior deltoid 29.8°.
    label: "Anterior deltoid",
    mainBundle: 1,
    slowShare: 0.55,
    bundles: [
      { label: "medial strand", pennation: 26, lfLm: 0.45, architecture: bipennate },
      { label: "central strand", pennation: 30, lfLm: 0.45, architecture: bipennate },
      { label: "lateral strand", pennation: 26, lfLm: 0.45, architecture: bipennate },
    ],
  },
  "side-delt": {
    // Multipennate; the 104-year-old specimen's 0° is not representative.
    label: "Lateral deltoid",
    mainBundle: 1,
    slowShare: 0.53,
    bundles: [
      { label: "anterior strand", pennation: 18, lfLm: 0.42, architecture: bipennate },
      { label: "central strand", pennation: 20, lfLm: 0.42, architecture: bipennate },
      { label: "posterior strand", pennation: 18, lfLm: 0.42, architecture: bipennate },
    ],
  },
  "rear-delt": {
    label: "Posterior deltoid",
    mainBundle: 1,
    slowShare: 0.56,
    bundles: [
      { label: "upper strand", pennation: 16, lfLm: 0.5, architecture: pennate },
      { label: "central strand", pennation: 18, lfLm: 0.5, architecture: pennate },
      { label: "lower strand", pennation: 16, lfLm: 0.5, architecture: pennate },
    ],
  },
  quads: {
    label: "Quadriceps",
    mainBundle: 0,
    slowShare: 0.48,
    bundles: [
      {
        label: "vastus lateralis",
        path: "vastus_lateralis_l",
        pennation: 18.4,
        lfLm: 0.38,
        architecture: pennate,
      },
      {
        label: "rectus femoris",
        path: "rectus_femoris_l",
        pennation: 13.9,
        lfLm: 0.21,
        architecture: bipennate,
      },
      {
        label: "vastus medialis",
        path: "vastus_medialis_l",
        pennation: 29.6,
        lfLm: 0.22,
        architecture: pennate,
      },
    ],
  },
  calves: {
    // Ward 2009: medial head 9.9°/0.19, lateral 12.0°/0.27, soleus 28.3°/0.11.
    // The atlas draws no soleus, so its band runs deep to the heads.
    label: "Calf",
    mainBundle: 0,
    slowShare: 0.72,
    bundles: [
      { label: "medial head", pennation: 9.9, lfLm: 0.19, architecture: bipennate },
      { label: "lateral head", pennation: 12, lfLm: 0.27, architecture: bipennate },
      { label: "soleus", pennation: 28.3, lfLm: 0.11, architecture: bipennate },
    ],
  },
  biceps: {
    // PLOS 2016: both heads 0° — biceps brachii really is parallel-fibred.
    label: "Biceps",
    mainBundle: 0,
    slowShare: 0.46,
    bundles: [
      {
        label: "long head",
        path: "biceps_brachii_caput_longum_l",
        pennation: 0,
        lfLm: 0.62,
        architecture: parallel,
      },
      {
        label: "short head",
        path: "biceps_brachii_caput_breve_l",
        pennation: 0,
        lfLm: 0.62,
        architecture: parallel,
      },
    ],
  },
  hamstrings: {
    label: "Hamstrings",
    mainBundle: 0,
    slowShare: 0.46,
    bundles: [
      {
        label: "biceps femoris",
        path: "biceps_femoris_l",
        pennation: 11.6,
        lfLm: 0.28,
        architecture: pennate,
      },
      {
        label: "semitendinosus",
        path: "semitendinosus_l",
        pennation: 12.9,
        lfLm: 0.65,
        architecture: pennate,
      },
      {
        label: "semimembranosus",
        path: "semimembranosus_1_l",
        pennation: 15.1,
        lfLm: 0.24,
        architecture: pennate,
      },
    ],
  },
  forearms: {
    label: "Forearm flexors",
    mainBundle: 0,
    slowShare: 0.5,
    bundles: [
      {
        label: "brachioradialis",
        path: "brachioradialis_r",
        pennation: 2,
        lfLm: 0.55,
        architecture: parallel,
      },
      {
        label: "wrist flexors",
        path: "flexor_carpi_radialis_r",
        pennation: 6,
        lfLm: 0.32,
        architecture: pennate,
      },
    ],
  },
  abs: {
    label: "Rectus abdominis",
    mainBundle: 1,
    slowShare: 0.55,
    bundles: [
      { label: "upper", pennation: 0, lfLm: 0.95, architecture: parallel },
      { label: "middle", pennation: 0, lfLm: 0.95, architecture: parallel },
      { label: "lower", pennation: 0, lfLm: 0.95, architecture: parallel },
    ],
  },
  "lower-back": {
    label: "Erector spinae",
    mainBundle: 1,
    slowShare: 0.58,
    bundles: [
      { label: "iliocostalis", pennation: 0, lfLm: 0.9, architecture: parallel },
      { label: "longissimus", pennation: 0, lfLm: 0.9, architecture: parallel },
      { label: "spinalis", pennation: 0, lfLm: 0.9, architecture: parallel },
    ],
  },
};

export const muscleSpec = (region: RegionId) => MUSCLES[region];

export function atlasRegion(region: RegionId) {
  return ATLAS_REGIONS[region];
}

export function atlasPaths(view: AtlasView): Record<string, string> {
  return view === "front" ? FRONT_PATHS : BACK_PATHS;
}

/**
 * Which part of the muscle a variation leans on. Matched against the lift's
 * id and name; anything unmatched falls back to the muscle's main bundle.
 */
const BUNDLE_HINTS: { region: RegionId; bundle: number; test: RegExp }[] = [
  { region: "chest", bundle: 0, test: /\bincline\b/ },
  { region: "chest", bundle: 2, test: /\b(decline|dips?)\b/ },
  { region: "lats", bundle: 0, test: /\b(pull.?over|straight.?arm)\b/ },
  { region: "lats", bundle: 2, test: /\b(close.?grip|neutral.?grip)\b/ },
  { region: "traps", bundle: 0, test: /\b(shrug|upright)\b/ },
  { region: "traps", bundle: 2, test: /\b(row|face.?pull)\b/ },
  { region: "biceps", bundle: 1, test: /\b(preacher|concentration|spider)\b/ },
  { region: "biceps", bundle: 0, test: /\b(hammer|incline|reverse|drag)\b/ },
  { region: "triceps", bundle: 1, test: /\b(overhead|skull|french|extension)\b/ },
  { region: "triceps", bundle: 0, test: /\b(pushdown|kick.?back|dips?)\b/ },
  { region: "triceps", bundle: 2, test: /\b(close.?grip|narrow)\b/ },
  { region: "quads", bundle: 1, test: /\b(sissy|extension|step.?up|front squat)\b/ },
  { region: "quads", bundle: 2, test: /\b(hack|narrow|close.?stance)\b/ },
  { region: "hamstrings", bundle: 0, test: /\b(stiff|romanian|rdl|good.?morning|deadlift)\b/ },
  { region: "hamstrings", bundle: 1, test: /\bcurl\b/ },
  { region: "calves", bundle: 2, test: /\bseated\b/ },
  { region: "glutes", bundle: 1, test: /\b(thrust|bridge)\b/ },
  { region: "glutes", bundle: 0, test: /\b(abduction|kick.?back)\b/ },
  { region: "abs", bundle: 2, test: /\b(hanging|leg.?raise|reverse crunch)\b/ },
  { region: "abs", bundle: 0, test: /\b(crunch|sit.?up)\b/ },
];

export function emphasisBundle(
  region: RegionId,
  exercise: { id: string; name: string },
): number {
  const text = `${exercise.id} ${exercise.name}`.toLowerCase().replace(/-/g, " ");
  for (const hint of BUNDLE_HINTS) {
    if (hint.region === region && hint.test.test(text)) return hint.bundle;
  }
  return MUSCLES[region].mainBundle;
}

/* ---------- Fascicle generation ---------- */

export interface Fascicle {
  d: string;
  /** 0–1 rank: the share of the pool recruited before this fascicle. */
  threshold: number;
  klass: FiberClass;
  bundle: number;
}

export interface Plate {
  view: AtlasView;
  crop: [number, number, number, number];
  /** Neighbours behind the belly, in the atlas's own drawing order. */
  under: string[];
  /** Neighbours in front of it. */
  over: string[];
  /** Outlines the fascicles live inside. */
  belly: string[];
  fascicles: Fascicle[];
}

/** Rule curves per belly, before any are dropped for falling outside it. */
const SWEEP = 68;
/** Samples along a rule curve when finding the span inside the outline. */
const PROBE = 56;
/** A span shorter than this share of the sweep is noise, not a fascicle. */
const MIN_SPAN = 0.1;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Deterministic scatter, so a muscle draws the same every time. */
const scatter = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

interface Hit {
  inside(x: number, y: number): boolean;
}

let hitCtx: CanvasRenderingContext2D | null | undefined;
let measureSvg: SVGSVGElement | null = null;

function context2d() {
  if (hitCtx === undefined) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    hitCtx = canvas.getContext("2d");
  }
  return hitCtx;
}

/** A detached path element cannot be measured in every engine, so keep one
 * hidden host in the document and reuse it. */
function measurer(): SVGSVGElement {
  if (!measureSvg) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.style.cssText =
      "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
    document.body.appendChild(svg);
    measureSvg = svg;
  }
  return measureSvg;
}

function hitTester(ds: string[]): Hit | null {
  const ctx = context2d();
  if (!ctx) return null;
  const shapes = ds.map((d) => new Path2D(d));
  return {
    inside: (x, y) => shapes.some((s) => ctx.isPointInPath(s, x, y)),
  };
}

/** Points along an outline, used for the long axis and the sweep extent. */
function outlinePoints(ds: string[]): Point[] {
  const svg = measurer();
  const out: Point[] = [];
  for (const d of ds) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
    el.setAttribute("d", d);
    svg.appendChild(el);
    const total = el.getTotalLength();
    const steps = Math.max(24, Math.min(160, Math.round(total / 3)));
    for (let i = 0; i < steps; i++) {
      const p = el.getPointAtLength((total * i) / steps);
      out.push([p.x, p.y]);
    }
    svg.removeChild(el);
  }
  return out;
}

/** Principal axis of a point cloud: the muscle's line of pull. */
function principalAxis(points: Point[]) {
  let cx = 0;
  let cy = 0;
  for (const [x, y] of points) {
    cx += x;
    cy += y;
  }
  cx /= points.length;
  cy /= points.length;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const [x, y] of points) {
    const dx = x - cx;
    const dy = y - cy;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const axis: Point = [Math.cos(theta), Math.sin(theta)];
  const normal: Point = [-axis[1], axis[0]];
  let along = 0;
  let across = 0;
  for (const [x, y] of points) {
    const dx = x - cx;
    const dy = y - cy;
    along = Math.max(along, Math.abs(dx * axis[0] + dy * axis[1]));
    across = Math.max(across, Math.abs(dx * normal[0] + dy * normal[1]));
  }
  return { center: [cx, cy] as Point, axis, normal, along, across };
}

/** The angular wedge an outline fills as seen from a tendon's midpoint. */
function subtended(points: Point[], tendon: [Point, Point]) {
  const mid: Point = [
    (tendon[0][0] + tendon[1][0]) / 2,
    (tendon[0][1] + tendon[1][1]) / 2,
  ];
  let sx = 0;
  let sy = 0;
  for (const [x, y] of points) {
    const a = Math.atan2(y - mid[1], x - mid[0]);
    sx += Math.cos(a);
    sy += Math.sin(a);
  }
  const base = Math.atan2(sy, sx);
  let lo = 0;
  let hi = 0;
  let reach = 0;
  for (const [x, y] of points) {
    let d = Math.atan2(y - mid[1], x - mid[0]) - base;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    lo = Math.min(lo, d);
    hi = Math.max(hi, d);
    reach = Math.max(reach, Math.hypot(x - mid[0], y - mid[1]));
  }
  // Hold the extreme rays off the border so they do not graze it.
  const inset = (hi - lo) * 0.02;
  return {
    mid,
    lo: base + lo + inset,
    hi: base + hi - inset,
    reach: reach * 1.25,
  };
}

const quadAt = (p0: Point, p1: Point, p2: Point, t: number): Point => {
  const u = 1 - t;
  return [
    u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
    u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
  ];
};

/** The sub-curve on [a, b], exactly, by blossoming. */
function quadSlice(p0: Point, p1: Point, p2: Point, a: number, b: number) {
  const blossom = (u: number, v: number): Point => [
    (1 - u) * (1 - v) * p0[0] + (u * (1 - v) + v * (1 - u)) * p1[0] + u * v * p2[0],
    (1 - u) * (1 - v) * p0[1] + (u * (1 - v) + v * (1 - u)) * p1[1] + u * v * p2[1],
  ];
  return [blossom(a, a), blossom(a, b), blossom(b, b)] as const;
}

const fmt = (n: number) => Math.round(n * 10) / 10;
const toPath = (p0: Point, p1: Point, p2: Point) =>
  `M${fmt(p0[0])} ${fmt(p0[1])}Q${fmt(p1[0])} ${fmt(p1[1])} ${fmt(p2[0])} ${fmt(p2[1])}`;

/**
 * Lay one sweep of rule curves across a belly and keep the spans that fall
 * inside it. `lfLm` caps how much of each span survives, so a muscle with
 * short fascicles packs many short strokes and a long-fibred one does not.
 */
function sweepBelly(
  ds: string[],
  spec: BundleSpec,
  count: number,
  seed: number,
): { d: string; t: number }[] {
  const hit = hitTester(ds);
  if (!hit) return [];
  const points = outlinePoints(ds);
  if (points.length < 8) return [];
  const { center, axis, normal, along, across } = principalAxis(points);
  const out: { d: string; t: number }[] = [];
  const arch = spec.architecture;
  const theta = (spec.pennation * Math.PI) / 180;
  // Share of a ray's in-muscle span one fascicle takes up.
  const keep = Math.min(1, spec.lfLm * (arch.kind === "fan" ? 1.15 : 1.9));
  // A short-fibred belly holds proportionally more fascicles, so the sweep
  // thickens as they shorten and the striation stays an even weave.
  const rays = Math.round(count * Math.min(2, 1 / Math.max(0.5, keep)));
  // A rule curve has to start and end outside the belly for the trim to find
  // the real border, so every one is drawn over-long.
  const reach = Math.hypot(along, across) * 1.6;
  // A fan sweeps the angle the outline actually subtends at its tendon, so
  // the fascicles cover the whole belly however it is shaped.
  const fanSweep =
    arch.kind === "fan" ? subtended(points, arch.tendon) : null;

  for (let i = 0; i < rays; i++) {
    const t = (i + 0.5) / rays;
    let p0: Point;
    let p2: Point;
    let bow = 0;
    const side = arch.kind === "pennate" && arch.both && i % 2 === 1 ? -1 : 1;

    if (arch.kind === "fan" && fanSweep) {
      // A convergent muscle gathers onto a short tendon, not onto a point,
      // so each fascicle lands at its own place along that segment.
      const [ta, tb] = arch.tendon;
      const angle = lerp(fanSweep.lo, fanSweep.hi, t);
      // Origins ride the wedge about the tendon's midpoint; insertions walk
      // the tendon itself, so the gather is a seam and not a single knot.
      p0 = [
        fanSweep.mid[0] + Math.cos(angle) * fanSweep.reach,
        fanSweep.mid[1] + Math.sin(angle) * fanSweep.reach,
      ];
      p2 = [lerp(ta[0], tb[0], t), lerp(ta[1], tb[1], t)];
      bow = (t - 0.5) * across * 0.24;
    } else {
      // Parallel and pennate differ only by the angle the fascicles make
      // with the line of pull: pennation is measured from that line, so 0°
      // runs straight along it. Bipennate mirrors about the midline.
      const u =
        arch.kind === "pennate" && arch.both
          ? (Math.floor(i / 2) + 0.5) / (rays / 2)
          : t;
      const off =
        arch.kind === "pennate" && arch.both
          ? side * (0.03 + 1.15 * u) * across
          : (u - 0.5) * 2 * across * 1.1;
      const mid: Point = [
        center[0] + normal[0] * off,
        center[1] + normal[1] * off,
      ];
      const tilt = side * theta;
      const dir: Point = [
        axis[0] * Math.cos(tilt) + normal[0] * Math.sin(tilt),
        axis[1] * Math.cos(tilt) + normal[1] * Math.sin(tilt),
      ];
      p0 = [mid[0] - dir[0] * reach, mid[1] - dir[1] * reach];
      p2 = [mid[0] + dir[0] * reach, mid[1] + dir[1] * reach];
      bow = (u - 0.5) * across * 0.08;
    }

    const mid: Point = [(p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2];
    const chord = Math.hypot(p2[0] - p0[0], p2[1] - p0[1]) || 1;
    const perp: Point = [-(p2[1] - p0[1]) / chord, (p2[0] - p0[0]) / chord];
    const p1: Point = [mid[0] + perp[0] * bow, mid[1] + perp[1] * bow];

    // A bipennate half only owns its own side of the midline, so the two
    // families meet at the central tendon instead of crossing through it.
    const halfSide = arch.kind === "pennate" && arch.both ? side : 0;
    const within = (x: number, y: number): boolean => {
      if (!hit.inside(x, y)) return false;
      if (!halfSide) return true;
      const d = (x - center[0]) * normal[0] + (y - center[1]) * normal[1];
      return d * halfSide > -across * 0.05;
    };

    // Longest run of probe points inside the outline. Both ends are the last
    // sample known to be inside, so the span never hangs over the border.
    const step = 1 / PROBE;
    let bestA = -1;
    let bestB = -1;
    let runA = -1;
    let prev = -1;
    for (let j = 0; j <= PROBE; j++) {
      const u = j / PROBE;
      if (within(...quadAt(p0, p1, p2, u))) {
        if (runA < 0) runA = u;
        prev = u;
        if (j === PROBE && u - runA > bestB - bestA) {
          bestA = runA;
          bestB = u;
        }
      } else {
        if (runA >= 0 && prev - runA > bestB - bestA) {
          bestA = runA;
          bestB = prev;
        }
        runA = -1;
      }
    }
    if (bestA < 0 || bestB - bestA < MIN_SPAN) continue;

    // Walk each end out onto the real edge, which sits inside the next step.
    const edgeAt = (inside: number, outside: number) => {
      let lo = inside;
      let hi = outside;
      for (let k = 0; k < 6; k++) {
        const mid = (lo + hi) / 2;
        const [x, y] = quadAt(p0, p1, p2, mid);
        if (within(x, y)) lo = mid;
        else hi = mid;
      }
      return lo;
    };
    if (bestA > 0) bestA = edgeAt(bestA, Math.max(0, bestA - step));
    if (bestB < 1) bestB = edgeAt(bestB, Math.min(1, bestB + step));

    // Measured architecture caps the fascicle. The span inside the outline
    // is this ray's muscle length, so Lf/Lm scales against that: a
    // short-fibred belly packs many short strokes, a long-fibred one spans.
    const limit = (bestB - bestA) * keep;
    let a = bestA;
    let b = bestB;
    if (b - a > limit) {
      const slack = b - a - limit;
      // A fan holds its origin end, so the shortfall opens as the tendon it
      // gathers onto rather than closing to a knot. Everything else slides
      // freely along its ray, which tiles the belly instead of banding it.
      a += slack * (arch.kind === "fan" ? 0.16 * scatter(seed + i) : scatter(seed + i));
      b = a + limit;
    }

    const [q0, q1, q2] = quadSlice(p0, p1, p2, a, b);
    out.push({ d: toPath(q0, q1, q2), t });
  }
  return out;
}

const plateCache = new Map<string, Plate>();

/**
 * One muscle's fascicles, each carrying the pool share recruited before it.
 * Thresholds are rank-normalised, so lighting the fascicles under a given
 * share lights exactly that share. Johnson et al. (1973) found fibre types
 * distributed at random through a muscle rather than grouped, so the ranking
 * is scattered through the belly instead of banded. Fascicles in the
 * emphasised bundle rank earlier, so the targeted part lights first.
 */
export function buildPlate(region: RegionId, emphasis: number): Plate {
  const key = `${region}:${emphasis}`;
  const cached = plateCache.get(key);
  if (cached) return cached;

  const atlas = ATLAS_REGIONS[region];
  const spec = MUSCLES[region];
  const paths = atlasPaths(atlas.view);
  const bellyIds = [...atlas.belly];
  const bellyDs = atlas.bellyShape
    ? [atlas.bellyShape]
    : bellyIds.map((id) => paths[id]);

  const raw: { d: string; bundle: number }[] = [];
  const perBundle = spec.bundles.some((b) => b.path);

  if (perBundle) {
    // Each bundle is a real outline with its own measured architecture.
    spec.bundles.forEach((bundle, index) => {
      const d = bundle.path ? paths[bundle.path] : undefined;
      if (!d) return;
      const share = Math.round(SWEEP / spec.bundles.length) + 6;
      for (const f of sweepBelly([d], bundle, share, index * 97)) {
        raw.push({ d: f.d, bundle: index });
      }
    });
  } else {
    // One outline carries every bundle, so position names them. Parts give
    // the real sub-outlines where the atlas draws them.
    const parts = atlas.parts.map((id) => hitTester([paths[id]]));
    const lead = spec.bundles[spec.mainBundle];
    // A bipennate sweep spends half its curves on each side of the midline,
    // so it needs more of them to reach the same density.
    const count =
      lead.architecture.kind === "pennate" && lead.architecture.both
        ? Math.round(SWEEP * 1.5)
        : SWEEP;
    for (const f of sweepBelly(bellyDs, lead, count, 11)) {
      let bundle: number;
      if (parts.length === 2 && parts[0] && parts[1]) {
        const m = f.d.match(/^M([-\d.]+) ([-\d.]+)/);
        const x = m ? Number(m[1]) : 0;
        const y = m ? Number(m[2]) : 0;
        bundle = parts[0].inside(x, y) ? 0 : parts[1].inside(x, y) ? 2 : 1;
      } else {
        bundle = Math.min(
          spec.bundles.length - 1,
          Math.floor(f.t * spec.bundles.length),
        );
      }
      raw.push({ d: f.d, bundle });
    }
  }

  const ranked = raw
    .map((fascicle, index) => ({
      index,
      priority:
        fascicle.bundle === emphasis
          ? scatter(index + 1) * 0.52
          : 0.48 + scatter(index + 1) * 0.52,
    }))
    .sort((a, b) => a.priority - b.priority);

  const edges = fiberEdges(spec.slowShare);
  const fascicles = new Array<Fascicle>(raw.length);
  ranked.forEach((entry, rank) => {
    const threshold = rank / Math.max(1, raw.length - 1);
    fascicles[entry.index] = {
      d: raw[entry.index].d,
      threshold,
      klass: classAt(threshold, edges),
      bundle: raw[entry.index].bundle,
    };
  });

  const paint = (ids: string[]) => ids.map((id) => paths[id]);
  const plate: Plate = {
    view: atlas.view,
    crop: [...atlas.crop] as [number, number, number, number],
    under: paint(atlas.under),
    over: paint(atlas.over),
    belly: bellyDs,
    fascicles,
  };
  plateCache.set(key, plate);
  return plate;
}
