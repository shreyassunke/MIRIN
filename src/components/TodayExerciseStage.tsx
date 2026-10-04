import type { Exercise } from "../db/db";
import {
  equipmentForExercise,
  exerciseLabelForMethod,
  inputModesForEquipment,
  resolveInputMethod,
} from "../lib/library";
import {
  lateralityCaption,
  lateralityLimbForRegion,
  loadSharing,
  supportsLaterality,
} from "../lib/laterality";
import { regionForExercise } from "../lib/muscleRegions";
import type { StageDraft } from "../lib/stageDraft";
import { MANUAL_STEP, round2, type InputMethod, type Unit } from "../lib/units";
import { Stepper } from "./Stepper";
import {
  BarbellPicker,
  BarbellRack,
  BarWeightControl,
} from "./weight/BarbellPicker";
import { DumbbellPicker } from "./weight/DumbbellPicker";
import { LoadInstrument } from "./weight/LoadInstrument";

interface TodayExerciseStageProps {
  exercise: Exercise;
  draft: StageDraft;
  unit: Unit;
  /** The shared WebGL canvas sits on the exercise currently in front. */
  live: boolean;
  onMode: (mode: InputMethod) => void;
  onReps: (reps: number) => void;
  onDumbbell: (value: number) => void;
  onManual: (value: number) => void;
  onBar: (bar: number, plates: number[]) => void;
  onLaterality: () => void;
}

export function exerciseStageTitle(exercise: Exercise, draft: StageDraft) {
  return exerciseLabelForMethod(exercise.name, draft.mode);
}

/** The full logging stage for one exercise. Neighbors mount this too, so a swipe reveals a finished page. */
export function TodayExerciseStage({
  exercise,
  draft,
  unit,
  live,
  onMode,
  onReps,
  onDumbbell,
  onManual,
  onBar,
  onLaterality,
}: TodayExerciseStageProps) {
  const equipment = equipmentForExercise(exercise);
  const modes = inputModesForEquipment(equipment);
  const mode = modes.some((item) => item.id === draft.mode)
    ? draft.mode
    : resolveInputMethod(equipment, draft.mode);
  const limb = lateralityLimbForRegion(regionForExercise(exercise));
  const lateralityLabel = lateralityCaption(
    draft.laterality,
    loadSharing(mode, equipment),
    limb,
  );
  const lateralityNextLabel = lateralityCaption(
    draft.laterality === "bilateral" ? "unilateral" : "bilateral",
    loadSharing(mode, equipment),
    limb,
  );
  const manualLaterality = supportsLaterality("manual", equipment);

  return (
    <LoadInstrument
      unit={unit}
      modes={modes}
      mode={mode}
      swipe={false}
      onModeChange={onMode}
      reps={draft.reps}
      onRepsChange={onReps}
      pages={modes.map((item) => {
        if (item.id === "barbell") {
          return {
            id: item.id,
            label: item.label,
            weight: round2(
              draft.barWeight +
                2 * draft.plates.reduce((sum, plate) => sum + plate, 0),
            ),
            weightDisplay: (
              <BarWeightControl
                unit={unit}
                barWeight={draft.barWeight}
                plates={draft.plates}
                onChange={onBar}
              />
            ),
            stage: (
              <BarbellPicker
                key={`${exercise.id}:${unit}`}
                unit={unit}
                barWeight={draft.barWeight}
                plates={draft.plates}
                live={live && mode === "barbell"}
                onChange={onBar}
              />
            ),
            extras: (
              <BarbellRack
                unit={unit}
                barWeight={draft.barWeight}
                plates={draft.plates}
                onChange={onBar}
              />
            ),
          };
        }
        if (item.id === "dumbbell") {
          return {
            id: item.id,
            label: item.label,
            weight: draft.dumbbell,
            weightDisplay: (
              <Stepper
                label={`Weight (${unit})`}
                value={draft.dumbbell}
                step={MANUAL_STEP[unit]}
                min={0}
                layout="readout"
                inlineSuffix={unit}
                size="lead"
                onChange={onDumbbell}
              />
            ),
            qualifier:
              draft.laterality === "bilateral"
                ? lateralityCaption(draft.laterality, "independent")
                : undefined,
            stage: (
              <DumbbellPicker
                unit={unit}
                value={draft.dumbbell}
                laterality={draft.laterality}
                live={live && mode === "dumbbell"}
                onChange={onDumbbell}
                onToggleLaterality={onLaterality}
              />
            ),
          };
        }
        return {
          id: item.id,
          label: item.label,
          weight: draft.manualWeight,
          weightDisplay: (
            <Stepper
              label={`Weight (${unit})`}
              value={draft.manualWeight}
              step={MANUAL_STEP[unit]}
              min={0}
              layout="readout"
              inlineSuffix={unit}
              size="lead"
              onChange={onManual}
            />
          ),
          qualifier: manualLaterality ? lateralityLabel : undefined,
          onQualifierClick: manualLaterality ? onLaterality : undefined,
          qualifierAria: manualLaterality
            ? `${lateralityLabel}. Switch to ${lateralityNextLabel}`
            : undefined,
        };
      })}
    />
  );
}
