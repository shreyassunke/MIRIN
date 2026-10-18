import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Exercise } from "../db/db";
import type { CableAttachmentId } from "../lib/cableAttachment";
import {
  equipmentForExercise,
  exerciseLabelForMethod,
  inputModesForEquipment,
  gymMachineFor,
  isGymMachineId,
  resolveInputMethod,
  stationsForExercise,
} from "../lib/library";
import {
  lateralityCaption,
  lateralityLimbForRegion,
  loadSharing,
  supportsLaterality,
} from "../lib/laterality";
import { regionForExercise } from "../lib/muscleRegions";
import type { StageDraft } from "../lib/stageDraft";
import {
  MANUAL_STEP,
  round2,
  stepDumbbell,
  type InputMethod,
  type Unit,
} from "../lib/units";
import {
  choiceForDraft,
  currentVariationId,
  variationById,
  variationsFor,
  type VariationChoice,
} from "../lib/variations";
import { MachineStationPicker } from "./MachineStationPicker";
import { Stepper } from "./Stepper";
import { VariationSheet, VariationWell } from "./VariationSheet";
import {
  BarbellPicker,
  BarbellRack,
  BarWeightControl,
} from "./weight/BarbellPicker";
import { DumbbellPicker } from "./weight/DumbbellPicker";
import { CableAttachmentPicker } from "./weight/CableAttachmentPicker";
import { GymMachinePicker } from "./weight/GymMachinePicker";
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
  onAttachment: (id: CableAttachmentId) => void;
  onVariation: (choice: VariationChoice) => void;
  onStation: (id: string) => void;
  /** Log control, beside the weight and reps. */
  headerAction?: ReactNode;
  headerCaption?: string;
  /** Phone thumb dock. The live weight line renders here. */
  headerDock?: HTMLElement | null;
  /** Neighbor pages on a phone omit their own weight line. */
  suppressHeader?: boolean;
  /** Bumps when the overflow menu asks to change this exercise. */
  variationRequest?: number;
  /** Logged sets for this exercise, on the desktop line. */
  logbook?: ReactNode;
}

/** The gloss on the live number, in the same words the stage prints. */
export function stageLoadQualifier(
  exercise: Exercise,
  draft: StageDraft,
): string | undefined {
  const choice = variationById(exercise, draft.variationId);
  const equipment = choice?.equipment ?? equipmentForExercise(exercise);
  const modes = inputModesForEquipment(equipment);
  const mode = modes.some((item) => item.id === draft.mode)
    ? draft.mode
    : resolveInputMethod(equipment, draft.mode);
  const label = lateralityCaption(
    draft.laterality,
    loadSharing(mode, equipment),
    lateralityLimbForRegion(regionForExercise(exercise)),
  );
  if (mode === "dumbbell") {
    return draft.laterality === "bilateral"
      ? lateralityCaption(draft.laterality, "independent")
      : label;
  }
  if (mode === "manual" && supportsLaterality("manual", equipment)) return label;
  return undefined;
}

export function exerciseStageTitle(exercise: Exercise, draft: StageDraft) {
  // The title is the lift's name. A machine or cable swap changes the
  // instrument, not the name the lifter just edited.
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
  onAttachment,
  onVariation,
  onStation,
  headerAction,
  headerCaption,
  headerDock,
  suppressHeader,
  variationRequest = 0,
  logbook,
}: TodayExerciseStageProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const seenVariation = useRef(0);
  const [open, setOpen] = useState(false);
  const choice = variationById(exercise, draft.variationId);
  const equipment = choice?.equipment ?? equipmentForExercise(exercise);
  const modes = inputModesForEquipment(equipment);
  const mode = modes.some((item) => item.id === draft.mode)
    ? draft.mode
    : resolveInputMethod(equipment, draft.mode);
  const stationChoices = stationsForExercise(exercise);
  const pickedStation =
    draft.station && isGymMachineId(draft.station) ? draft.station : null;
  const station = gymMachineFor({
    ...exercise,
    equipment,
    isCustom: true,
    station: pickedStation ?? exercise.station,
  });
  const machine =
    station &&
    station !== "cable" &&
    (equipment === "machine" || station === "seated-row")
      ? station
      : null;
  const cable = equipment === "cable" && !machine;
  const options = variationsFor(exercise);
  const currentId = currentVariationId(exercise, draft);
  const wellLabel = choiceForDraft(exercise, draft).label;

  useEffect(() => {
    if (!live) setOpen(false);
  }, [live]);

  useEffect(() => {
    if (variationRequest === seenVariation.current) return;
    seenVariation.current = variationRequest;
    if (variationRequest > 0) setOpen(true);
  }, [variationRequest]);

  useEffect(() => {
    if (!open || equipment !== "machine") return;
    trayRef.current?.scrollIntoView({ block: "nearest" });
  }, [open, equipment]);

  const openList = () => {
    if (live) setOpen(true);
  };

  return (
    <div ref={anchorRef}>
      {logbook}
      <LoadInstrument
        unit={unit}
        modes={modes}
        mode={mode}
        swipe={false}
        onModeChange={onMode}
        reps={draft.reps}
        onRepsChange={onReps}
        headerAction={headerAction}
        headerCaption={headerCaption}
        headerDock={headerDock}
        suppressHeader={suppressHeader}
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
                  drag
                  onDragStep={(direction, current) =>
                    stepDumbbell(current, unit, direction)
                  }
                  onChange={onDumbbell}
                />
              ),
              stage: (
                <DumbbellPicker
                  unit={unit}
                  value={draft.dumbbell}
                  laterality={draft.laterality}
                  live={live && mode === "dumbbell"}
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
                drag
                onChange={onManual}
              />
            ),
            stage: cable ? (
              <CableAttachmentPicker
                attachment={draft.cableAttachment}
                unit={unit}
                value={draft.manualWeight}
                live={live}
                onChange={onManual}
                onAttachment={onAttachment}
              />
            ) : machine ? (
              <GymMachinePicker
                machine={machine}
                unit={unit}
                value={draft.manualWeight}
                live={live}
                onChange={onManual}
              />
            ) : (
              <VariationWell label={wellLabel} onEdit={openList} />
            ),
          };
        })}
      />
      {open && (
        <VariationSheet
          anchorRef={anchorRef}
          label={`Change ${exercise.name}`}
          options={options}
          currentId={currentId}
          onClose={() => setOpen(false)}
          onPick={(next) => {
            onVariation(next);
            if (next.equipment === "machine" && stationChoices.length > 0) return;
            setOpen(false);
          }}
        >
          {equipment === "machine" && stationChoices.length > 0 ? (
            <div
              ref={trayRef}
              className="px-1.5 pt-1 pb-1"
              onKeyDown={(event) => event.stopPropagation()}
            >
              <MachineStationPicker
                stations={stationChoices}
                value={pickedStation}
                onChange={(id) => {
                  onStation(id);
                  setOpen(false);
                }}
              />
            </div>
          ) : null}
        </VariationSheet>
      )}
    </div>
  );
}
