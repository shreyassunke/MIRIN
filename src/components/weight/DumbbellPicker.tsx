import { lazy, Suspense } from "react";
import type { Unit } from "../../lib/units";
import type { Laterality } from "../../lib/laterality";
import { ModelHit, type VariationHit } from "./ModelHit";
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
  /** Tap on the bells opens the variation list. */
  hit?: VariationHit;
}

function BellStageFallback() {
  return <div className="weight-stage weight-stage-bell" style={{ pointerEvents: "none" }} aria-hidden="true" />;
}

export function DumbbellPicker({
  unit,
  value,
  laterality,
  live = true,
  hit,
}: DumbbellPickerProps) {
  const pair = laterality === "bilateral";
  const fallback = <BellStageFallback />;
  const stage = !hasWebGL() ? (
    fallback
  ) : (
    <ChunkErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <Dumbbell3D unit={unit} value={value} pair={pair} live={live} />
      </Suspense>
    </ChunkErrorBoundary>
  );
  if (!hit) return stage;
  return <ModelHit hit={{ ...hit, live: hit.live ?? live }}>{stage}</ModelHit>;
}
