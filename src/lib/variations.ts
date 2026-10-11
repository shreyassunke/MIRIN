import type { Exercise } from "../db/db";
import {
  equipmentForExercise,
  equipmentLabel,
  inputMethodForEquipment,
  isLatPulldownMachine,
} from "./library";
import {
  defaultLaterality,
  loadSharing,
  type Laterality,
  type LoadSharing,
} from "./laterality";
import {
  DEFAULT_BAR,
  MANUAL_STEP,
  decomposePlates,
  nearestDumbbell,
  round2,
  toCanonical,
  toDisplay,
  type InputMethod,
  type Unit,
} from "./units";

/**
 * A way to do the programmed lift today. The day template keeps the
 * original exercise; this only changes the instrument in front of the lifter.
 */
export interface VariationChoice {
  id: string;
  label: string;
  equipment: string;
  laterality: Laterality;
  mode: InputMethod;
}

const GENERIC: VariationChoice[] = [
  { id: "machine", label: "Machine", equipment: "machine", laterality: "bilateral", mode: "manual" },
  { id: "cable", label: "Cable", equipment: "cable", laterality: "bilateral", mode: "manual" },
  { id: "cable-unilateral", label: "One-arm cable", equipment: "cable", laterality: "unilateral", mode: "manual" },
  { id: "dumbbell", label: "Dumbbell", equipment: "dumbbell", laterality: "bilateral", mode: "dumbbell" },
  { id: "dumbbell-unilateral", label: "Dumbbell, one side", equipment: "dumbbell", laterality: "unilateral", mode: "dumbbell" },
  { id: "barbell", label: "Barbell", equipment: "barbell", laterality: "bilateral", mode: "barbell" },
  { id: "bodyweight", label: "Bodyweight", equipment: "bodyweight", laterality: "bilateral", mode: "manual" },
];

/** Names a lifter would actually say for a pulldown. */
const LAT_PULLDOWN: VariationChoice[] = [
  { id: "machine", label: "Machine lat pulldown", equipment: "machine", laterality: "bilateral", mode: "manual" },
  { id: "machine-unilateral", label: "One-arm lat pulldown", equipment: "machine", laterality: "unilateral", mode: "manual" },
  { id: "cable", label: "Cable pulldown", equipment: "cable", laterality: "bilateral", mode: "manual" },
  { id: "cable-unilateral", label: "One-arm cable pulldown", equipment: "cable", laterality: "unilateral", mode: "manual" },
  { id: "bodyweight", label: "Pull-up", equipment: "bodyweight", laterality: "bilateral", mode: "manual" },
  { id: "dumbbell", label: "Dumbbell", equipment: "dumbbell", laterality: "bilateral", mode: "dumbbell" },
  { id: "barbell", label: "Barbell", equipment: "barbell", laterality: "bilateral", mode: "barbell" },
];

type LibraryExercise = {
  id: string;
  name: string;
  equipment?: string;
  isCustom?: boolean;
};

export function variationsFor(exercise: LibraryExercise): VariationChoice[] {
  if (isLatPulldownMachine(exercise)) return LAT_PULLDOWN;
  return GENERIC;
}

export function variationById(
  exercise: LibraryExercise,
  id: string | null | undefined,
): VariationChoice | null {
  if (!id) return null;
  return variationsFor(exercise).find((choice) => choice.id === id) ?? null;
}

/**
 * The programmed station. A kettlebell or band that the list does not name
 * still has a choice, so converting back to it has a from-side.
 */
export function nativeVariation(exercise: LibraryExercise): VariationChoice {
  const equipment = equipmentForExercise(exercise as Exercise);
  const laterality = defaultLaterality(exercise.name);
  const list = variationsFor(exercise);
  return (
    list.find((choice) => choice.equipment === equipment && choice.laterality === laterality) ??
    list.find((choice) => choice.equipment === equipment) ?? {
      id: `native:${equipment}:${laterality}`,
      label: equipmentLabel(equipment),
      equipment,
      laterality,
      mode: inputMethodForEquipment(equipment),
    }
  );
}

/** Which row is checked. Null when the stage is on an implement the list does not name. */
export function currentVariationId(
  exercise: LibraryExercise,
  draft: { variationId: string | null; mode: InputMethod; laterality: Laterality },
): string | null {
  if (draft.variationId) return draft.variationId;
  const equipment = equipmentForExercise(exercise as Exercise);
  const natural = inputMethodForEquipment(equipment);
  const list = variationsFor(exercise);
  if (draft.mode !== natural) {
    return (
      list.find((choice) => choice.mode === draft.mode && choice.laterality === draft.laterality)?.id ??
      null
    );
  }
  return (
    list.find((choice) => choice.equipment === equipment && choice.laterality === draft.laterality)?.id ??
    null
  );
}

/** The implement the stage is on right now, programmed or substitute. */
export function choiceForDraft(
  exercise: LibraryExercise,
  draft: { variationId: string | null; mode: InputMethod; laterality: Laterality },
): VariationChoice {
  return (
    variationById(exercise, draft.variationId) ??
    variationById(exercise, currentVariationId(exercise, draft)) ??
    nativeVariation(exercise)
  );
}

function sharingOf(choice: VariationChoice): LoadSharing {
  return loadSharing(choice.mode, choice.equipment);
}

function snapExternal(weight: number, choice: VariationChoice, unit: Unit): number {
  if (choice.mode === "dumbbell") return nearestDumbbell(Math.max(0, weight), unit);
  if (choice.mode === "barbell") return round2(Math.max(0, weight));
  const step = MANUAL_STEP[unit];
  return round2(Math.max(0, Math.round(weight / step) * step));
}

/**
 * Shared stack ↔ per hand is half or double. Bodyweight clears the load.
 * Coming back from bodyweight uses the load that was on the station before.
 */
export function convertLoadForVariation(
  weight: number,
  from: VariationChoice,
  to: VariationChoice,
  unit: Unit,
  heldDisplay: number,
): number {
  if (to.equipment === "bodyweight") return 0;
  const source = from.equipment === "bodyweight" ? heldDisplay : weight;
  if (source <= 0) return 0;
  const fromSharing = sharingOf(from);
  const toSharing = sharingOf(to);
  let next = source;
  if (fromSharing !== toSharing) {
    next = toSharing === "independent" ? source / 2 : source * 2;
  } else if (fromSharing === "shared" && from.laterality !== to.laterality) {
    next = to.laterality === "unilateral" ? source / 2 : source * 2;
  }
  return snapExternal(next, to, unit);
}

export interface VariationDraftPatch {
  variationId: string | null;
  mode: InputMethod;
  laterality: Laterality;
  heldLoadLb: number;
  barWeight: number;
  plates: number[];
  dumbbell: number;
  manualWeight: number;
}

/** The stage fields a chosen variation writes. Reps stay where they are. */
export function draftPatchForVariation(args: {
  exercise: LibraryExercise;
  from: VariationChoice;
  to: VariationChoice;
  /** Live external load, display unit. Ignored when `from` is bodyweight. */
  total: number;
  /** Last external load in canonical pounds, kept across a bodyweight detour. */
  heldLoadLb: number;
  barWeight: number;
  unit: Unit;
}): VariationDraftPatch {
  const native = nativeVariation(args.exercise);
  const heldDisplay = toDisplay(args.heldLoadLb, args.unit);
  const weight = convertLoadForVariation(
    args.total,
    args.from,
    args.to,
    args.unit,
    heldDisplay,
  );
  const heldLoadLb =
    args.to.equipment === "bodyweight"
      ? args.from.equipment === "bodyweight"
        ? args.heldLoadLb
        : toCanonical(args.total, args.unit)
      : toCanonical(weight, args.unit);
  const mode = args.to.mode;
  const base = {
    variationId: args.to.id === native.id ? null : args.to.id,
    mode,
    laterality: args.to.laterality,
    heldLoadLb,
    barWeight: args.barWeight,
    plates: [] as number[],
    dumbbell: nearestDumbbell(weight, args.unit),
    manualWeight: weight,
  };
  if (mode === "barbell") {
    const bar = args.barWeight > 0 ? args.barWeight : DEFAULT_BAR[args.unit];
    return {
      ...base,
      barWeight: bar,
      plates: decomposePlates(Math.max(weight, bar), bar, args.unit),
    };
  }
  return base;
}
