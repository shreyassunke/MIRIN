import type { Gender } from "./body";
import { KG_PER_LB, cmToInches } from "./units";

export interface MetricInputs {
  gender: Gender | null;
  heightCm: number | null;
  /** Canonical pounds. */
  weightLbs: number | null;
  /** Canonical centimetres. */
  waistCm: number | null;
  neckCm: number | null;
  hipsCm: number | null;
}

export interface DerivedMetrics {
  bmi: number | null;
  /** Standard BMI band for the computed value. */
  bmiBand: string | null;
  bodyFatPct: number | null;
  leanLbs: number | null;
  fatLbs: number | null;
  ffmi: number | null;
  /** Human-readable list of what each unavailable metric still needs. */
  bmiNeeds: string[];
  bodyFatNeeds: string[];
}

const metres = (cm: number) => cm / 100;

/** Weight relative to height squared. Reads high on muscular builds. */
export function bmi(weightLbs: number, heightCm: number): number | null {
  const m = metres(heightCm);
  if (m <= 0) return null;
  const value = (weightLbs * KG_PER_LB) / (m * m);
  return Number.isFinite(value) ? value : null;
}

export function bmiBand(value: number): string {
  if (value < 18.5) return "Underweight range";
  if (value < 25) return "Normal range";
  if (value < 30) return "Overweight range";
  return "Obese range";
}

/**
 * US Navy circumference estimate. Men need neck and waist; women also need
 * hips. Returns null when the tape values cannot produce a real result.
 */
export function navyBodyFat(input: {
  gender: Gender;
  heightCm: number;
  neckCm: number;
  waistCm: number;
  hipsCm?: number | null;
}): number | null {
  const heightIn = cmToInches(input.heightCm);
  const neck = cmToInches(input.neckCm);
  const waist = cmToInches(input.waistCm);
  if (heightIn <= 0) return null;

  let value: number;
  if (input.gender === "male") {
    const girth = waist - neck;
    if (girth <= 0) return null;
    value =
      86.01 * Math.log10(girth) - 70.041 * Math.log10(heightIn) + 36.76;
  } else {
    if (input.hipsCm == null) return null;
    const hips = cmToInches(input.hipsCm);
    const girth = waist + hips - neck;
    if (girth <= 0) return null;
    value =
      163.205 * Math.log10(girth) -
      97.684 * Math.log10(heightIn) -
      78.387;
  }

  if (!Number.isFinite(value)) return null;
  // Outside this band the tape was misread, not the body composition.
  if (value < 2 || value > 70) return null;
  return value;
}

/** Lean mass relative to height squared — the muscle-aware counterpart to BMI. */
export function ffmi(leanLbs: number, heightCm: number): number | null {
  const m = metres(heightCm);
  if (m <= 0) return null;
  const value = (leanLbs * KG_PER_LB) / (m * m);
  return Number.isFinite(value) ? value : null;
}

export function deriveMetrics(input: MetricInputs): DerivedMetrics {
  const bmiNeeds: string[] = [];
  if (input.heightCm == null) bmiNeeds.push("height");
  if (input.weightLbs == null) bmiNeeds.push("body weight");

  const bmiValue =
    input.heightCm != null && input.weightLbs != null
      ? bmi(input.weightLbs, input.heightCm)
      : null;

  const bodyFatNeeds: string[] = [];
  if (input.gender == null) bodyFatNeeds.push("gender");
  if (input.heightCm == null) bodyFatNeeds.push("height");
  if (input.neckCm == null) bodyFatNeeds.push("neck");
  if (input.waistCm == null) bodyFatNeeds.push("waist");
  if (input.gender === "female" && input.hipsCm == null) {
    bodyFatNeeds.push("hips");
  }

  const bodyFatPct =
    bodyFatNeeds.length === 0 &&
    input.gender != null &&
    input.heightCm != null &&
    input.neckCm != null &&
    input.waistCm != null
      ? navyBodyFat({
          gender: input.gender,
          heightCm: input.heightCm,
          neckCm: input.neckCm,
          waistCm: input.waistCm,
          hipsCm: input.hipsCm,
        })
      : null;

  const leanLbs =
    bodyFatPct != null && input.weightLbs != null
      ? input.weightLbs * (1 - bodyFatPct / 100)
      : null;
  const fatLbs =
    bodyFatPct != null && input.weightLbs != null
      ? input.weightLbs * (bodyFatPct / 100)
      : null;

  return {
    bmi: bmiValue,
    bmiBand: bmiValue != null ? bmiBand(bmiValue) : null,
    bodyFatPct,
    leanLbs,
    fatLbs,
    ffmi:
      leanLbs != null && input.heightCm != null
        ? ffmi(leanLbs, input.heightCm)
        : null,
    bmiNeeds,
    bodyFatNeeds,
  };
}

export interface FieldProgress {
  start: number;
  latest: number;
  target: number;
  /** Signed distance still to cover, in canonical units. */
  remaining: number;
  /** 0–1 share of the start-to-target distance already covered. */
  fraction: number;
  reached: boolean;
}

/**
 * Direction-agnostic: a shrinking waist and a growing arm both read as
 * forward progress because the start value anchors the span.
 */
export function fieldProgress(
  start: number,
  latest: number,
  target: number,
): FieldProgress {
  const span = target - start;
  const covered = latest - start;
  const reached = span === 0 ? latest === target : covered / span >= 1;
  const fraction =
    span === 0 ? (reached ? 1 : 0) : Math.min(1, Math.max(0, covered / span));
  return {
    start,
    latest,
    target,
    remaining: target - latest,
    fraction,
    reached,
  };
}
