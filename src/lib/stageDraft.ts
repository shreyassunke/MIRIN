import type { Exercise, SetLog } from "../db/db";
import { workingSets, warmupDisplayWeight } from "./exerciseMeta";
import {
  resolveCableAttachment,
  type CableAttachmentId,
} from "./cableAttachment";
import {
  attachmentForEquipment,
  equipmentForExercise,
  resolveInputMethod,
} from "./library";
import {
  convertLoadForLaterality,
  defaultLaterality,
  loadSharing,
  type Laterality,
} from "./laterality";
import {
  DEFAULT_BAR,
  decomposePlates,
  nearestDumbbell,
  round2,
  toCanonical,
  toDisplay,
  type InputMethod,
  type Unit,
} from "./units";
import { convertLoadForVariation, nativeVariation, variationById } from "./variations";
import {
  defaultInputMethodFor,
  defaultRepsFor,
  startWeightFor,
} from "./workout";

/** One exercise's logging stage. Stable while the user is editing it. */
export type StageDraft = {
  /** Changes when the set being logged changes, so edits are not wiped mid-set. */
  base: string;
  mode: InputMethod;
  laterality: Laterality;
  barWeight: number;
  plates: number[];
  dumbbell: number;
  manualWeight: number;
  reps: number;
  loggingWarmup: boolean;
  /** Clip on a cable station. Ignored for bar, bell, and selectorized machines. */
  cableAttachment: CableAttachmentId;
  /** Null is the programmed station. A string is today's substitute. */
  variationId: string | null;
  /** Selectorized station while today's substitute is a machine. */
  station: string | null;
  /** Last external load in canonical pounds. Survives a bodyweight detour. */
  heldLoadLb: number;
};

export function stageTotal(draft: StageDraft): number {
  if (draft.mode === "barbell") {
    return round2(
      draft.barWeight + 2 * draft.plates.reduce((sum, plate) => sum + plate, 0),
    );
  }
  if (draft.mode === "dumbbell") return draft.dumbbell;
  return draft.manualWeight;
}

function progressOf(logs: SetLog[], warmupTarget: number) {
  const working = workingSets(logs).length;
  const warmupCount = logs.filter((log) => log.isWarmup).length;
  return {
    working,
    warmupCount,
    loggingWarmup: warmupCount < warmupTarget,
    todayWorking: workingSets(logs),
  };
}

export function resolveStageDraft(args: {
  exercise: Exercise;
  logs: SetLog[];
  prior: SetLog[];
  warmupTarget: number;
  unit: Unit;
  dayTemplateId: string | null;
  modePref?: InputMethod;
  lateralityPref?: Laterality;
  cableAttachmentPref?: string;
  /** Today's substitute, from the session. Ignored when `carry` is present. */
  sessionVariationId?: string | null;
  /** Today's machine station, from the session. Ignored when `carry` is present. */
  sessionStation?: string | null;
  carry?: {
    mode?: InputMethod;
    laterality?: Laterality;
    cableAttachment?: CableAttachmentId;
    variationId?: string | null;
    heldLoadLb?: number;
    station?: string | null;
  };
}): StageDraft {
  const { exercise, prior, unit } = args;
  const { working, warmupCount, loggingWarmup, todayWorking } = progressOf(
    args.logs,
    args.warmupTarget,
  );
  const source =
    prior[working] ??
    prior[prior.length - 1] ??
    todayWorking[todayWorking.length - 1];

  const variationId = args.carry
    ? (args.carry.variationId ?? null)
    : (args.sessionVariationId ?? null);
  const sessionChoice = variationById(exercise, variationId);
  const equipment = sessionChoice?.equipment ?? equipmentForExercise(exercise);
  const lastMethod = prior[prior.length - 1]?.inputMethod;
  const preferredMode = resolveInputMethod(
    equipment,
    args.modePref ??
      lastMethod ??
      defaultInputMethodFor(exercise.id, exercise.inputMethodHint),
  );
  const mode = sessionChoice
    ? sessionChoice.mode
    : resolveInputMethod(equipment, args.carry?.mode ?? preferredMode);
  const laterality = sessionChoice
    ? sessionChoice.laterality
    : (args.carry?.laterality ??
      prior[prior.length - 1]?.laterality ??
      args.lateralityPref ??
      defaultLaterality(exercise.name));

  const workingLb =
    source?.weight ??
    (attachmentForEquipment(equipment) === "bodyweight"
      ? 0
      : startWeightFor(exercise.id));
  const rawDisplay = loggingWarmup
    ? warmupDisplayWeight(workingLb, warmupCount, unit)
    : toDisplay(workingLb, unit);
  const programmedDisplay = source
    ? convertLoadForLaterality(
        rawDisplay,
        source.laterality ?? "bilateral",
        laterality,
        loadSharing(mode, equipment),
        unit,
      )
    : rawDisplay;
  let weight = programmedDisplay;
  let heldLoadLb =
    args.carry?.heldLoadLb ??
    (source && !source.variationId ? source.weight : toCanonical(programmedDisplay, unit));
  if (sessionChoice) {
    const same =
      source?.variationId != null && source.variationId === sessionChoice.id;
    if (same && source) {
      weight = loggingWarmup ? rawDisplay : toDisplay(source.weight, unit);
      if (sessionChoice.equipment !== "bodyweight") heldLoadLb = source.weight;
    } else if (sessionChoice.equipment === "bodyweight") {
      weight = 0;
      heldLoadLb =
        args.carry?.heldLoadLb ??
        (source && !source.variationId ? source.weight : heldLoadLb);
    } else {
      const from = source?.variationId
        ? (variationById(exercise, source.variationId) ?? nativeVariation(exercise))
        : nativeVariation(exercise);
      const baseLb =
        from.equipment === "bodyweight"
          ? (args.carry?.heldLoadLb ?? heldLoadLb)
          : (source && !source.variationId ? source.weight : (args.carry?.heldLoadLb ?? heldLoadLb));
      weight = convertLoadForVariation(
        toDisplay(baseLb, unit),
        from,
        sessionChoice,
        unit,
        toDisplay(baseLb, unit),
      );
      if (loggingWarmup && weight > 0) {
        weight = warmupDisplayWeight(toCanonical(weight, unit), warmupCount, unit);
      }
      heldLoadLb = toCanonical(weight, unit);
    }
  }

  const fallbackReps = defaultRepsFor(args.dayTemplateId ?? "");
  const reps = loggingWarmup
    ? Math.max(5, (source?.reps ?? fallbackReps) - warmupCount)
    : (source?.reps ?? fallbackReps);

  let barWeight = DEFAULT_BAR[unit];
  let plates: number[] = [];
  let dumbbell = nearestDumbbell(weight, unit);
  let manualWeight = weight;

  if (mode === "barbell") {
    const breakdown = !loggingWarmup ? source?.loadBreakdown : undefined;
    if (source?.inputMethod === "barbell" && breakdown?.platesPerSide) {
      const bar = breakdown.barWeight ?? toCanonical(DEFAULT_BAR[unit], unit);
      barWeight = toDisplay(bar, unit);
      plates = breakdown.platesPerSide
        .map((plate) => toDisplay(plate, unit))
        .sort((a, b) => b - a);
    } else {
      plates = decomposePlates(weight, DEFAULT_BAR[unit], unit);
    }
  } else if (mode === "dumbbell") {
    dumbbell = nearestDumbbell(weight, unit);
  } else {
    manualWeight = weight;
  }

  return {
    base: `${args.dayTemplateId ?? "rest"}:${working}:${warmupCount}:${loggingWarmup ? 1 : 0}:${unit}`,
    mode,
    laterality,
    barWeight,
    plates,
    dumbbell,
    manualWeight,
    reps,
    loggingWarmup,
    cableAttachment: resolveCableAttachment(
      exercise,
      args.carry?.cableAttachment ?? args.cableAttachmentPref,
    ),
    variationId: sessionChoice?.id ?? null,
    station: (args.carry ? args.carry.station : args.sessionStation) ?? exercise.station ?? null,
    heldLoadLb,
  };
}

export function syncStageDrafts(
  exercises: Exercise[],
  prev: Record<string, StageDraft>,
  ctx: {
    unit: Unit;
    dayTemplateId: string | null;
    logsByExercise: Map<string, SetLog[]>;
    prefills: Record<string, SetLog[]>;
    modePrefs: Record<string, InputMethod>;
    lateralityPrefs: Record<string, Laterality>;
    cableAttachmentPrefs: Record<string, string>;
    warmupTargets: Record<string, number>;
    variations: Record<string, string>;
    stations: Record<string, string>;
  },
): { next: Record<string, StageDraft>; changed: boolean } {
  let changed = false;
  const next: Record<string, StageDraft> = { ...prev };
  for (const exercise of exercises) {
    const logs = ctx.logsByExercise.get(exercise.id) ?? [];
    const { working, warmupCount, loggingWarmup } = progressOf(
      logs,
      ctx.warmupTargets[exercise.id] ?? 0,
    );
    const base = `${ctx.dayTemplateId ?? "rest"}:${working}:${warmupCount}:${loggingWarmup ? 1 : 0}:${ctx.unit}`;
    const current = prev[exercise.id];
    if (current && current.base === base) continue;
    changed = true;
    next[exercise.id] = resolveStageDraft({
      exercise,
      logs,
      prior: ctx.prefills[exercise.id] ?? [],
      warmupTarget: ctx.warmupTargets[exercise.id] ?? 0,
      unit: ctx.unit,
      dayTemplateId: ctx.dayTemplateId,
      modePref: ctx.modePrefs[exercise.id],
      lateralityPref: ctx.lateralityPrefs[exercise.id],
      cableAttachmentPref: ctx.cableAttachmentPrefs[exercise.id],
      sessionVariationId: ctx.variations[exercise.id] ?? null,
      sessionStation: ctx.stations[exercise.id] ?? null,
      carry: current
        ? {
            mode: current.mode,
            laterality: current.laterality,
            cableAttachment: current.cableAttachment,
            variationId: current.variationId,
            heldLoadLb: current.heldLoadLb,
            station: current.station,
          }
        : undefined,
    });
  }
  return changed ? { next, changed } : { next: prev, changed: false };
}
