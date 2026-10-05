import { lazy, Suspense } from "react";
import type { GymMachineId } from "../../lib/library";
import type { Unit } from "../../lib/units";
import { GYM_MACHINE_STAGE } from "./gymMachine";
import { ChunkErrorBoundary, hasWebGL } from "./three/fallback";

const loadGymMachine3D = () =>
  import("./three/GymMachine3D").then((m) => ({ default: m.GymMachine3D }));
const GymMachine3D = lazy(loadGymMachine3D);
void loadGymMachine3D();

interface GymMachinePickerProps {
  machine: GymMachineId;
  unit: Unit;
  value: number;
  onChange: (value: number) => void;
  live?: boolean;
}

export function GymMachinePicker({
  machine,
  unit,
  value,
  onChange,
  live = true,
}: GymMachinePickerProps) {
  const fallback = (
    <div className={GYM_MACHINE_STAGE[machine]} data-gym-machine={machine} aria-hidden="true" />
  );
  if (!hasWebGL()) return fallback;
  return (
    <ChunkErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <GymMachine3D
          machine={machine}
          unit={unit}
          value={value}
          live={live}
          onChange={onChange}
        />
      </Suspense>
    </ChunkErrorBoundary>
  );
}
