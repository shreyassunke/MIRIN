export type Unit = "lb" | "kg";
export type LengthUnit = "in" | "cm";
export type InputMethod = "barbell" | "dumbbell" | "manual";

const LB_PER_KG = 2.2046226218;
const CM_PER_IN = 2.54;

export const round2 = (x: number) => Math.round(x * 100) / 100;

/**
 * One decimal, trailing zero trimmed. Tape readings and body-composition
 * estimates are not precise to a hundredth, so displaying one would lie.
 */
export const formatMeasure = (v: number) => String(parseFloat(v.toFixed(1)));

export const KG_PER_LB = 1 / LB_PER_KG;

/** Canonical storage is always pounds. Convert for display. */
export const toDisplay = (lbs: number, unit: Unit) =>
  unit === "lb" ? round2(lbs) : round2(lbs / LB_PER_KG);

/** Convert a display-unit value back to canonical pounds. */
export const toCanonical = (value: number, unit: Unit) =>
  unit === "lb" ? round2(value) : round2(value * LB_PER_KG);

export const BAR_OPTIONS: Record<Unit, number[]> = {
  lb: [45, 35],
  kg: [20, 15],
};

export const DEFAULT_BAR: Record<Unit, number> = { lb: 45, kg: 20 };

/** Plate denominations per side, largest first (display unit). */
export const PLATE_SIZES: Record<Unit, number[]> = {
  lb: [45, 35, 25, 10, 5, 2.5],
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
};

/** 10+ is a work plate; 5 and under is change. */
export function isChangePlate(value: number) {
  return value < 10;
}

/**
 * Gym plate color conventions. These appear only on plate chips and
 * the loaded-bar instrument — never elsewhere in the UI.
 */
export const PLATE_COLORS: Record<Unit, Record<number, string>> = {
  lb: {
    45: "#1f4fa3", // blue
    35: "#f2c500", // yellow
    25: "#1e8c4a", // green
    10: "#f2f2f2", // white
    5: "#d22a2a", // red
    2.5: "#6e6e6e", // black
  },
  kg: {
    25: "#d22a2a", // red
    20: "#1f4fa3", // blue
    15: "#f2c500", // yellow
    10: "#1e8c4a", // green
    5: "#f2f2f2", // white
    2.5: "#d22a2a", // red
    1.25: "#98989f", // silver
  },
};

export const plateColor = (unit: Unit, value: number) =>
  PLATE_COLORS[unit][value] ?? "#8a8a8a";

/** Ink on a plate face: dark on light bumpers so the denomination still reads. */
export function plateInk(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16);
  if (!Number.isFinite(n)) return "#fafafa";
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return L > 0.5 ? "#0a0a0a" : "#fafafa";
}

function buildDumbbells(unit: Unit): number[] {
  if (unit === "lb") {
    const values: number[] = [];
    for (let v = 2.5; v <= 25; v += 2.5) values.push(v);
    for (let v = 30; v <= 100; v += 5) values.push(v);
    return values;
  }
  return [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30,
    32.5, 35, 37.5, 40, 45, 50,
  ];
}

export const DUMBBELL_SIZES: Record<Unit, number[]> = {
  lb: buildDumbbells("lb"),
  kg: buildDumbbells("kg"),
};

export function nearestDumbbell(value: number, unit: Unit): number {
  const sizes = DUMBBELL_SIZES[unit];
  let best = sizes[0];
  for (const size of sizes) {
    if (Math.abs(size - value) < Math.abs(best - value)) best = size;
  }
  return best;
}

/**
 * Greedy decomposition of a total into per-side plates for a given bar.
 * Best-effort: a total that doesn't divide evenly returns the closest
 * stack under it (the picker shows its own live total, so no lies).
 */
export function decomposePlates(
  total: number,
  barWeight: number,
  unit: Unit,
): number[] {
  let perSide = (total - barWeight) / 2;
  if (perSide <= 0) return [];
  const plates: number[] = [];
  for (const size of PLATE_SIZES[unit]) {
    while (perSide >= size - 1e-6) {
      plates.push(size);
      perSide = round2(perSide - size);
    }
  }
  return plates;
}

/** Manual stepper increment per unit. */
export const MANUAL_STEP: Record<Unit, number> = { lb: 5, kg: 2.5 };

export const unitLabel = (unit: Unit) => unit;

/* ---------- Tape measurements: canonical storage is always centimetres ---------- */

export const toLengthDisplay = (cm: number, unit: LengthUnit) =>
  unit === "cm" ? round2(cm) : round2(cm / CM_PER_IN);

export const toLengthCanonical = (value: number, unit: LengthUnit) =>
  unit === "cm" ? round2(value) : round2(value * CM_PER_IN);

export const cmToInches = (cm: number) => cm / CM_PER_IN;

/** Tape increments: half an inch is the finest a tape reliably reads. */
export const LENGTH_STEP: Record<LengthUnit, number> = { in: 0.5, cm: 1 };
export const HEIGHT_STEP: Record<LengthUnit, number> = { in: 1, cm: 1 };

/** Body weight moves in smaller steps than a loaded bar. */
export const BODY_WEIGHT_STEP: Record<Unit, number> = { lb: 1, kg: 0.5 };

/** Feet and inches when imperial; whole centimetres when metric. */
export function formatHeight(cm: number, unit: LengthUnit): string {
  if (unit === "cm") return `${Math.round(cm)} cm`;
  const totalInches = Math.round(cmToInches(cm));
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches - feet * 12;
  return `${feet}′ ${inches}″`;
}
