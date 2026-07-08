export type Unit = "lb" | "kg";
export type InputMethod = "barbell" | "dumbbell" | "manual";

const LB_PER_KG = 2.2046226218;

export const round2 = (x: number) => Math.round(x * 100) / 100;

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

/**
 * Muted takes on real plate color conventions. Subtle by design: these
 * appear only on plate chips and the loaded-bar illustration.
 */
export const PLATE_COLORS: Record<Unit, Record<number, string>> = {
  lb: {
    45: "#5b7d9e", // blue
    35: "#a08f56", // yellow
    25: "#5f8a6e", // green
    10: "#c2c2c2", // white
    5: "#6e6e6e", // black
    2.5: "#98989f", // silver
  },
  kg: {
    25: "#9e6060", // red
    20: "#5b7d9e", // blue
    15: "#a08f56", // yellow
    10: "#5f8a6e", // green
    5: "#c2c2c2", // white
    2.5: "#6e6e6e", // black
    1.25: "#98989f", // silver
  },
};

export const plateColor = (unit: Unit, value: number) =>
  PLATE_COLORS[unit][value] ?? "#8a8a8a";

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
