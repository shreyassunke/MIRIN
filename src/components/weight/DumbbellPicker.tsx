import {
  lazy,
  Suspense,
  type KeyboardEvent,
} from "react";
import { DUMBBELL_SIZES, type Unit } from "../../lib/units";
import { lateralityCaption, type Laterality } from "../../lib/laterality";
import { formatWeight } from "../../lib/workout";
import { ChunkErrorBoundary, hasWebGL } from "./three/fallback";

const loadDumbbell3D = () =>
  import("./three/Dumbbell3D").then((m) => ({ default: m.Dumbbell3D }));
const Dumbbell3D = lazy(loadDumbbell3D);
void loadDumbbell3D();

interface DumbbellPickerProps {
  unit: Unit;
  value: number;
  laterality: Laterality;
  onChange: (value: number) => void;
  onToggleLaterality: () => void;
  live?: boolean;
  onSwipe?: (direction: -1 | 1) => void;
}

function stepValue(unit: Unit, value: number, delta: number): number {
  const sizes = DUMBBELL_SIZES[unit];
  const current = sizes.indexOf(value);
  const index = current < 0 ? 0 : current;
  return sizes[Math.max(0, Math.min(sizes.length - 1, index + delta))];
}

function BellStageFallback() {
  return <div className="mx-auto h-36 w-full max-w-xs" />;
}

function DumbbellIcon({
  live = true,
  ...props
}: {
  unit: Unit;
  value: number;
  pair: boolean;
  live?: boolean;
  onChange: (value: number) => void;
  onToggleLaterality: () => void;
  onSwipe?: (direction: -1 | 1) => void;
}) {
  const fallback = <BellStageFallback />;
  if (!hasWebGL()) return fallback;
  return (
    <ChunkErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <Dumbbell3D
          unit={props.unit}
          value={props.value}
          pair={props.pair}
          live={live}
          onChange={props.onChange}
          onTap={props.onToggleLaterality}
          onSwipe={props.onSwipe}
        />
      </Suspense>
    </ChunkErrorBoundary>
  );
}

export function DumbbellPicker({
  unit,
  value,
  laterality,
  onChange,
  onToggleLaterality,
  live = true,
  onSwipe,
}: DumbbellPickerProps) {
  const sizes = DUMBBELL_SIZES[unit];
  const pair = laterality === "bilateral";
  const loadCaption = pair
    ? lateralityCaption("bilateral", "independent")
    : null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowUp" || event.key === "ArrowRight") {
      event.preventDefault();
      const next = stepValue(unit, value, 1);
      if (next !== value) onChange(next);
    } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
      event.preventDefault();
      const next = stepValue(unit, value, -1);
      if (next !== value) onChange(next);
    } else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      onToggleLaterality();
    }
  };

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={`Dumbbell weight (${unit})`}
      aria-orientation="vertical"
      aria-valuemin={sizes[0]}
      aria-valuemax={sizes[sizes.length - 1]}
      aria-valuenow={value}
      aria-valuetext={`${formatWeight(value)} ${unit}${loadCaption ? ` ${loadCaption}` : ""}, ${pair ? "pair" : "single"}`}
      onKeyDown={onKeyDown}
      className="outline-none"
    >
      <span className="sr-only">
        {pair
          ? "Pair. Activate to switch to single."
          : "Single. Activate to switch to pair."}
      </span>
      <DumbbellIcon
        unit={unit}
        value={value}
        pair={pair}
        live={live}
        onChange={onChange}
        onToggleLaterality={onToggleLaterality}
        onSwipe={onSwipe}
      />
    </div>
  );
}
