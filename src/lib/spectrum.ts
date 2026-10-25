import type { SetLog } from "../db/db";
import { workingSets } from "./exerciseMeta";
import { recommendNextSet } from "./overload";
import { toDisplay, type InputMethod, type Unit } from "./units";

/**
 * The reel tints only the number under the finger. Weight is scored against
 * this lifter's two weights; reps against the two rep counts. The other
 * number stays steel, and it only changes the score when it has already left
 * the band — a reckless load cannot turn the reps green.
 *
 * Place 0 is the repeated working set. Place 1 is the prescription. An exact
 * match of both numbers is a solid pigment. Anywhere short of that, including
 * the stretch between the anchors, is a gradient: the estimate, not the setup.
 * Warm-ups and a lift with no working history stay ink.
 */

export type SpectrumAxis = "weight" | "reps";

export interface SpectrumSet {
  /** Display units. */
  weight: number;
  reps: number;
}

export interface SpectrumAnchor {
  maintenance: SpectrumSet;
  growth: SpectrumSet;
}

export interface SpectrumPaint {
  /** Foot of the glyph, and the whole glyph when the setup is exact. */
  color: string;
  /** Crown of a ballpark gradient. Equals `color` when the pigment is solid. */
  crown: string;
  /** Same as `crown`. Kept so a contrast check can read the lighter end. */
  soft: string;
  /** True on an exact anchor and at a fully committed danger end. */
  solid: boolean;
  glow: string;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

const DARK_INK: RGB = { r: 250, g: 250, b: 250 };
const LIGHT_INK: RGB = { r: 22, g: 22, b: 22 };

/** Pigments, used as themselves. Sage is a green, not a mint washed into the ink. */
const PIGMENT = {
  sage: { r: 64, g: 176, b: 84 },
  sand: { r: 214, g: 170, b: 64 },
  rose: { r: 206, g: 104, b: 88 },
  danger: { r: 214, g: 52, b: 46 },
};

/** Light-mode inks. Dark enough to read on the paper ground. */
const LIGHT_HUE = {
  sage: { r: 14, g: 118, b: 42 },
  sand: { r: 132, g: 96, b: 16 },
  rose: { r: 148, g: 54, b: 44 },
  danger: { r: 158, g: 28, b: 24 },
};

function clamp(value: number, low: number, high: number) {
  return Math.min(high, Math.max(low, value));
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

function rgbCss(color: RGB) {
  return `rgb(${Math.round(color.r)} ${Math.round(color.g)} ${Math.round(color.b)})`;
}

function displaySet(log: SetLog, unit: Unit): SpectrumSet {
  return { weight: toDisplay(log.weight, unit), reps: log.reps };
}

/** Heaviest working weight, and the best reps at that weight. */
function heaviest(logs: SetLog[], unit: Unit): SetLog | null {
  const working = workingSets(logs);
  if (working.length === 0) return null;
  return working.reduce((best, log) => {
    const weight = toDisplay(log.weight, unit);
    const bestWeight = toDisplay(best.weight, unit);
    if (weight > bestWeight || (weight === bestWeight && log.reps > best.reps)) {
      return log;
    }
    return best;
  });
}

export function spectrumAnchor(args: {
  today: SetLog[];
  prior: SetLog[];
  mode: InputMethod;
  unit: Unit;
  fallbackReps: number;
  /** A warm-up is not the working stimulus, so the reel stays ink. */
  loggingWarmup?: boolean;
}): SpectrumAnchor | null {
  if (args.loggingWarmup) return null;
  const growth = recommendNextSet(args);
  if (!growth) return null;
  const todayWorking = workingSets(args.today);
  const maintained =
    todayWorking.length > 0
      ? todayWorking[todayWorking.length - 1]
      : heaviest(args.prior, args.unit);
  if (!maintained) return null;
  return {
    maintenance: displaySet(maintained, args.unit),
    growth: { weight: growth.weight, reps: growth.reps },
  };
}

function near(axis: SpectrumAxis, a: number, b: number) {
  return Math.abs(a - b) <= (axis === "weight" ? 0.5 : 0.25);
}

function read(set: SpectrumSet, axis: SpectrumAxis) {
  return axis === "weight" ? set.weight : set.reps;
}

/** 0 inside the band. 1 once the value has clearly left it. */
function departure(axis: SpectrumAxis, value: number, lo: number, hi: number) {
  const slack = axis === "weight" ? 0.5 : 0.25;
  const lightReach = axis === "weight" ? Math.max(lo * 0.2, 12) : 4;
  const heavyReach = axis === "weight" ? Math.max(hi * 0.12, 10) : 4;
  if (value < lo - slack) {
    return { side: "light" as const, t: clamp((lo - value) / lightReach, 0, 1) };
  }
  if (value > hi + slack) {
    return { side: "heavy" as const, t: clamp((value - hi) / heavyReach, 0, 1) };
  }
  return { side: "in" as const, t: 0 };
}

/** 0 at maintenance, 1 at the prescription, before either danger end. */
function along(value: number, maintenance: number, growth: number) {
  const span = growth - maintenance;
  if (Math.abs(span) < 0.05) return 1;
  return (value - maintenance) / span;
}

function pull(place: number, side: "light" | "heavy" | "in", t: number) {
  if (side === "light") return place + (-1.35 - place) * t;
  if (side === "heavy") return place + (2.35 - place) * t;
  return place;
}

/**
 * 0 is maintenance on this axis, 1 is the prescription. Negative is too
 * light. Past 1, and climbing, is too heavy. Monotonic in `value`.
 */
export function spectrumPlace(
  axis: SpectrumAxis,
  value: number,
  other: number,
  anchor: SpectrumAnchor,
): number {
  const mine = axis;
  const heldAxis: SpectrumAxis = axis === "weight" ? "reps" : "weight";
  const maintenance = read(anchor.maintenance, mine);
  const growth = read(anchor.growth, mine);
  const lo = Math.min(maintenance, growth);
  const hi = Math.max(maintenance, growth);
  const current = Math.max(0, value);

  const heldMaintenance = read(anchor.maintenance, heldAxis);
  const heldGrowth = read(anchor.growth, heldAxis);
  let place: number;
  if (Math.abs(growth - maintenance) < 0.05) {
    const reach = mine === "weight" ? Math.max(hi * 0.12, 10) : 5;
    const delta = current - maintenance;
    if (near(mine, current, maintenance)) {
      if (Math.abs(heldGrowth - heldMaintenance) < 0.05 || near(heldAxis, other, heldGrowth)) {
        place = 1;
      } else if (near(heldAxis, other, heldMaintenance)) place = 0;
      else place = clamp(along(other, heldMaintenance, heldGrowth), 0, 1);
    } else if (delta > 0) place = 1 + (2.35 - 1) * clamp(delta / reach, 0, 1);
    else place = 1 + (-1.35 - 1) * clamp(-delta / reach, 0, 1);
  } else {
    const left = departure(mine, current, lo, hi);
    if (left.side === "in") place = clamp(along(current, maintenance, growth), 0, 1);
    else if (left.side === "light") {
      const edge = clamp(along(lo, maintenance, growth), 0, 1);
      place = edge + (-1.35 - edge) * left.t;
    } else {
      const edge = clamp(along(hi, maintenance, growth), 0, 1);
      place = edge + (2.35 - edge) * left.t;
    }
  }

  const held = departure(
    heldAxis,
    Math.max(0, other),
    Math.min(heldMaintenance, heldGrowth),
    Math.max(heldMaintenance, heldGrowth),
  );
  return pull(place, held.side, held.t);
}

function exactSetup(axis: SpectrumAxis, value: number, other: number, anchor: SpectrumAnchor) {
  const weight = axis === "weight" ? value : other;
  const reps = axis === "reps" ? value : other;
  const growth =
    near("weight", weight, anchor.growth.weight) && near("reps", reps, anchor.growth.reps);
  const maintenance =
    near("weight", weight, anchor.maintenance.weight) &&
    near("reps", reps, anchor.maintenance.reps);
  return growth || maintenance;
}

function hueAt(place: number, light: boolean): RGB {
  const sage = light ? LIGHT_HUE.sage : PIGMENT.sage;
  const sand = light ? LIGHT_HUE.sand : PIGMENT.sand;
  const rose = light ? LIGHT_HUE.rose : PIGMENT.rose;
  const danger = light ? LIGHT_HUE.danger : PIGMENT.danger;
  const knots: { at: number; color: RGB }[] = [
    { at: -1.35, color: danger },
    { at: -0.55, color: rose },
    { at: 0, color: sand },
    { at: 1, color: sage },
    { at: 1.55, color: rose },
    { at: 2.35, color: danger },
  ];
  if (place <= knots[0].at) return knots[0].color;
  const last = knots[knots.length - 1];
  if (place >= last.at) return last.color;
  for (let i = 0; i < knots.length - 1; i++) {
    const a = knots[i];
    const b = knots[i + 1];
    if (place <= b.at) return mix(a.color, b.color, (place - a.at) / (b.at - a.at));
  }
  return last.color;
}

export function spectrumTone(
  axis: SpectrumAxis,
  value: number,
  other: number,
  anchor: SpectrumAnchor,
  light = false,
): SpectrumPaint {
  const place = spectrumPlace(axis, value, other, anchor);
  const color = hueAt(place, light);
  const solid = exactSetup(axis, value, other, anchor) || place <= -1.15 || place >= 2.1;
  const ink = light ? LIGHT_INK : DARK_INK;
  const toward = place >= 1 ? place - 0.45 : place <= 0 ? place + 0.45 : place < 0.5 ? place - 0.4 : place + 0.4;
  const crown = solid
    ? color
    : mix(mix(color, hueAt(clamp(toward, -1.35, 2.35), light), 0.42), ink, light ? 0.06 : 0.18);
  const glowAlpha = solid ? 0 : 0.16;
  return {
    color: rgbCss(color),
    crown: rgbCss(crown),
    soft: rgbCss(crown),
    solid,
    glow: `rgb(${Math.round(color.r)} ${Math.round(color.g)} ${Math.round(color.b)} / ${glowAlpha.toFixed(2)})`,
  };
}
