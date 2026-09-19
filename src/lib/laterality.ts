import { round2, type InputMethod, type Unit } from "./units";

/** How many limbs the logged load represents. */
export type Laterality = "bilateral" | "unilateral";

export type LoadSharing = "shared" | "independent";

const UNILATERAL_NAME = /\b(one[-\s]?arm|single[-\s]?arm)\b/i;

/** Cable/machine stacks often notch at 2.5 lb / 1.25 kg. */
const LATERALITY_STEP: Record<Unit, number> = { lb: 2.5, kg: 1.25 };

export function isUnilateralName(name: string): boolean {
  return UNILATERAL_NAME.test(name);
}

export function defaultLaterality(name: string): Laterality {
  return isUnilateralName(name) ? "unilateral" : "bilateral";
}

/**
 * Pair/single-arm is a modifier on the current lift, not a different
 * exercise. Barbell and bodyweight keep their own named variants.
 */
export function supportsLaterality(
  inputMethod: InputMethod,
  equipment: string,
): boolean {
  if (inputMethod === "dumbbell") return true;
  if (inputMethod === "barbell") return false;
  return (
    equipment === "cable" ||
    equipment === "machine" ||
    equipment === "kettlebell" ||
    equipment === "dumbbell" ||
    equipment === "band"
  );
}

/**
 * Independent implements (dumbbells, kettlebells) are already logged
 * per hand. Shared loads (cables, machines) are one stack for both arms.
 */
export function loadSharing(
  inputMethod: InputMethod,
  equipment: string,
): LoadSharing {
  if (inputMethod === "dumbbell") return "independent";
  if (equipment === "dumbbell" || equipment === "kettlebell") {
    return "independent";
  }
  return "shared";
}

export function convertLoadForLaterality(
  weight: number,
  from: Laterality,
  to: Laterality,
  sharing: LoadSharing,
  unit: Unit,
): number {
  if (from === to || sharing === "independent" || weight <= 0) return weight;
  const step = LATERALITY_STEP[unit];
  const next = to === "unilateral" ? weight / 2 : weight * 2;
  return round2(Math.max(step, Math.round(next / step) * step));
}

/**
 * Unilateral shared-load sets are logged per side; volume counts both
 * sides so a 40×10 two-hand cable fly matches 20×10 per side.
 * Independent loads stay per-hand either way, so the multiplier is 1.
 */
export function volumeLimbs(
  laterality: Laterality | undefined,
  inputMethod: InputMethod | undefined,
  equipment?: string,
): number {
  if (laterality !== "unilateral") return 1;
  const sharing = loadSharing(inputMethod ?? "manual", equipment ?? "");
  return sharing === "shared" ? 2 : 1;
}

export function lateralityCaption(
  laterality: Laterality,
  sharing: LoadSharing,
): string {
  if (laterality === "unilateral") return "per side";
  return sharing === "independent" ? "per hand, pair" : "both arms";
}
