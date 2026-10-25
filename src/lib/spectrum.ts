import type { SetLog } from "../db/db";
import { workingSets } from "./exerciseMeta";
import { recommendNextSet } from "./overload";
import { toDisplay, type InputMethod, type Unit } from "./units";
import { epley } from "./workout";

/**
 * The reel's tint is this lifter's own double progression for this exercise.
 * Green is the prescription `recommendNextSet` already opens the stage on.
 * Sand is the working set they would be repeating: today's last working set,
 * or the heaviest prior working weight with the best reps there. Red is only
 * the load that has left both of those behind — lighter than the lighter one
 * (not enough tension) or heavier than the heavier one.
 *
 * One rep and a small plate share a scale. Epley says a rep is `weight / 30`,
 * so the pair is a point and the two anchors are a segment. Place 0 sits on
 * maintenance and place 1 on the prescription. Off that segment, a ratio past
 * about 6% of the heavier anchor, or under about 92% of the lighter one,
 * leaves the quiet band. Reps in reserve are the same inverted Epley the
 * fibre read uses, taken against the harder of the two anchors: past roughly
 * six in reserve the set is no longer near enough to count as the work.
 * Warm-ups and a lift with no working history stay ink.
 */

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
  /** The hue at the foot of the glyph. */
  color: string;
  /** The same hue lifted back toward the ink, for the top of the glyph. */
  soft: string;
  /** A low wash under the numerals. Stronger only at the danger end. */
  glow: string;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

const DARK_INK: RGB = { r: 250, g: 250, b: 250 };
const LIGHT_INK: RGB = { r: 22, g: 22, b: 22 };

/** Pigments. Dark mixes these into the ink so the numeral stays a light. */
const PIGMENT = {
  sage: { r: 142, g: 196, b: 158 },
  sand: { r: 214, g: 196, b: 142 },
  rose: { r: 196, g: 128, b: 120 },
  danger: { r: 196, g: 54, b: 48 },
};

/**
 * Light-mode inks. Dark enough to read on the paper ground. The danger end
 * is the only one allowed to carry a strong chroma.
 */
const LIGHT_HUE = {
  sage: { r: 32, g: 108, b: 64 },
  sand: { r: 120, g: 92, b: 36 },
  rose: { r: 142, g: 70, b: 62 },
  danger: { r: 158, g: 36, b: 32 },
};

function clamp(value: number, low: number, high: number) {
  return Math.min(high, Math.max(low, value));
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const span = edge1 - edge0;
  if (span === 0) return value >= edge1 ? 1 : 0;
  const t = clamp((value - edge0) / span, 0, 1);
  return t * t * (3 - 2 * t);
}

/** Linear, so a couple of pounds cannot fall off a curve. */
function ramp(start: number, full: number, value: number) {
  const span = full - start;
  if (span === 0) return value >= start ? 1 : 0;
  return clamp((value - start) / span, 0, 1);
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

function sameSet(a: SpectrumSet, b: SpectrumSet) {
  return Math.abs(a.weight - b.weight) < 0.05 && a.reps === b.reps;
}

function nearWeight(a: number, b: number) {
  return Math.abs(a - b) <= 0.5;
}

function nearReps(a: number, b: number) {
  return Math.abs(a - b) <= 0.25;
}

/** Reps are the whole stimulus when neither anchor carries a load. */
function repOnlyPlace(reps: number, maintenance: number, growth: number) {
  if (Math.abs(growth - maintenance) < 0.05) {
    if (reps >= maintenance) return clamp((reps - maintenance) / 3, 0, 1);
    return -1.35 * smoothstep(maintenance, Math.max(1, maintenance - 6), reps);
  }
  const along = (reps - maintenance) / (growth - maintenance);
  const floor = Math.min(maintenance, growth);
  if (reps < floor) {
    return -1.35 * smoothstep(floor, Math.max(1, floor * 0.55), reps);
  }
  return clamp(along, 0, 1);
}

/**
 * 0 is maintenance, 1 is the prescription. Negative is too light. Past 1,
 * and climbing, is too heavy. The two danger ends meet the same red.
 */
export function spectrumPlace(
  weight: number,
  reps: number,
  anchor: SpectrumAnchor,
): number {
  const maintenance = anchor.maintenance;
  const growth = anchor.growth;
  const load = Math.max(0, weight);
  const count = Math.max(0, reps);

  if (maintenance.weight <= 0 && growth.weight <= 0 && load <= 0) {
    return repOnlyPlace(count, maintenance.reps, growth.reps);
  }
  if (load <= 0 && Math.min(maintenance.weight, growth.weight) > 0) return -1.35;

  const floorW = Math.min(maintenance.weight, growth.weight);
  const ceilW = Math.max(maintenance.weight, growth.weight);
  const ref = Math.max(ceilW, 1);
  const cap = Math.max(
    epley(maintenance.weight, maintenance.reps),
    epley(growth.weight, growth.reps),
    1,
  );
  const proposed = epley(load, count);

  let along: number;
  if (sameSet(maintenance, growth)) {
    const ratio = proposed / Math.max(epley(maintenance.weight, maintenance.reps), 1);
    if (ratio >= 1 && ratio <= 1.055) along = (ratio - 1) / 0.055;
    else along = ratio > 1.055 ? 1 : 0;
  } else {
    const px = (load - maintenance.weight) / ref;
    const py = (count - maintenance.reps) / 30;
    const vx = (growth.weight - maintenance.weight) / ref;
    const vy = (growth.reps - maintenance.reps) / 30;
    const len2 = vx * vx + vy * vy;
    along = len2 < 1e-8 ? 0 : (px * vx + py * vy) / len2;
  }

  // A very light absolute anchor makes an e1RM ratio shout. The segment and
  // the weight ratio carry that case instead.
  const ratiosSpeak = cap >= 20;
  let light = 0;
  let heavy = 0;
  if (floorW > 0.5) light = Math.max(light, ramp(0.94, 0.74, load / floorW));
  if (ceilW > 0.5) heavy = Math.max(heavy, ramp(1.04, 1.14, load / ceilW));
  if (ratiosSpeak) {
    light = Math.max(light, ramp(0.96, 0.76, proposed / cap));
    heavy = Math.max(heavy, ramp(1.05, 1.14, proposed / cap));
    const rir = 30 * (cap / Math.max(load, 1) - 1) - count;
    light = Math.max(light, ramp(6, 13, rir));
  }

  const onAnchor =
    (nearWeight(load, growth.weight) && nearReps(count, growth.reps)) ||
    (nearWeight(load, maintenance.weight) && nearReps(count, maintenance.reps));
  // Float and a fraction of a pound should not knock an anchor off its hue.
  if (onAnchor) {
    if (light < 0.2) light = 0;
    if (heavy < 0.2) heavy = 0;
  }

  const segment = clamp(along, 0, 1);
  if (light >= heavy) return segment + (-1.35 - segment) * light;
  return segment + (2.35 - segment) * heavy;
}

function hueAt(place: number, light: boolean): RGB {
  const sage = light ? LIGHT_HUE.sage : mix(DARK_INK, PIGMENT.sage, 0.62);
  const sand = light ? LIGHT_HUE.sand : mix(DARK_INK, PIGMENT.sand, 0.58);
  const rose = light ? LIGHT_HUE.rose : mix(DARK_INK, PIGMENT.rose, 0.7);
  const danger = light ? LIGHT_HUE.danger : mix(DARK_INK, PIGMENT.danger, 0.94);
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

/** How far the pair has left the quiet band between maintenance and growth. */
function extremity(place: number) {
  return clamp(Math.max(-place, place - 1) / 1.15, 0, 1);
}

export function spectrumTone(
  weight: number,
  reps: number,
  anchor: SpectrumAnchor,
  light = false,
): SpectrumPaint {
  const place = spectrumPlace(weight, reps, anchor);
  const color = hueAt(place, light);
  const ink = light ? LIGHT_INK : DARK_INK;
  const far = extremity(place);
  const soft = mix(color, ink, light ? 0.22 : 0.5 - far * 0.34);
  const glowAlpha = 0.18 + far * 0.27;
  return {
    color: rgbCss(color),
    soft: rgbCss(soft),
    glow: `rgb(${Math.round(color.r)} ${Math.round(color.g)} ${Math.round(color.b)} / ${glowAlpha.toFixed(2)})`,
  };
}
