import { lazy, Suspense } from "react";
import type { Unit } from "../../lib/units";
import { ChunkErrorBoundary, hasWebGL } from "./three/fallback";

const loadLatPulldown3D = () =>
  import("./three/LatPulldown3D").then((m) => ({ default: m.LatPulldown3D }));
const LatPulldown3D = lazy(loadLatPulldown3D);
void loadLatPulldown3D();

interface LatPulldownPickerProps {
  unit: Unit;
  value: number;
  onChange: (value: number) => void;
  live?: boolean;
}

function MachineFallback() {
  return (
    <div
      className="mx-auto h-64 w-full max-w-sm"
      data-lat-pulldown=""
      aria-hidden="true"
    />
  );
}

export function LatPulldownPicker({
  unit,
  value,
  onChange,
  live = true,
}: LatPulldownPickerProps) {
  const fallback = <MachineFallback />;
  if (!hasWebGL()) return fallback;
  return (
    <ChunkErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <LatPulldown3D unit={unit} value={value} live={live} onChange={onChange} />
      </Suspense>
    </ChunkErrorBoundary>
  );
}
