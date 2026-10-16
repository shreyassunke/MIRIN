import { lazy, Suspense } from "react";
import type { Unit } from "../../lib/units";
import type { Laterality } from "../../lib/laterality";
import { ChunkErrorBoundary, hasWebGL } from "./three/fallback";

const loadDumbbell3D = () =>
  import("./three/Dumbbell3D").then((m) => ({ default: m.Dumbbell3D }));
const Dumbbell3D = lazy(loadDumbbell3D);
void loadDumbbell3D();

interface DumbbellPickerProps {
  unit: Unit;
  value: number;
  laterality: Laterality;
  live?: boolean;
}

function BellStageFallback() {
  return <div className="mx-auto h-36 w-full max-w-xs" style={{ pointerEvents: "none" }} aria-hidden="true" />;
}

export function DumbbellPicker({
  unit,
  value,
  laterality,
  live = true,
}: DumbbellPickerProps) {
  const pair = laterality === "bilateral";
  const fallback = <BellStageFallback />;
  if (!hasWebGL()) return fallback;
  return (
    <ChunkErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <Dumbbell3D unit={unit} value={value} pair={pair} live={live} />
      </Suspense>
    </ChunkErrorBoundary>
  );
}
