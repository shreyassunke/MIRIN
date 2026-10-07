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
  carry?: {
    mode?: InputMethod;
    laterality?: Laterality;
    cableAttachment?: CableAttachmentId;
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

  const equipment = equipmentForExercise(exercise);
  const lastMethod = prior[prior.length - 1]?.inputMethod;
  const preferredMode = resolveInputMethod(
    equipment,
    args.modePref ??
      lastMethod ??
      defaultInputMethodFor(exercise.id, exercise.inputMethodHint),
  );
  const mode = resolveInputMethod(
    equipment,
    args.carry?.mode ?? preferredMode,
  );
  const laterality =
    args.carry?.laterality ??
    prior[prior.length - 1]?.laterality ??
    args.lateralityPref ??
    defaultLaterality(exercise.name);

  const workingLb =
    source?.weight ??
    (attachmentForEquipment(equipment) === "bodyweight"
      ? 0
      : startWeightFor(exercise.id));
  const rawDisplay = loggingWarmup
    ? warmupDisplayWeight(workingLb, warmupCount, unit)
    : toDisplay(workingLb, unit);
  const weight = source
    ? convertLoadForLaterality(
        rawDisplay,
        source.laterality ?? "bilateral",
        laterality,
        loadSharing(mode, equipment),
        unit,
      )
    : rawDisplay;

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
      carry: current
        ? {
            mode: current.mode,
            laterality: current.laterality,
            cableAttachment: current.cableAttachment,
          }
        : undefined,
    });
  }
  return changed ? { next, changed } : { next: prev, changed: false };
}
