import { lazy, Suspense } from "react";
import { DUMBBELL_SIZES, type Unit } from "../../lib/units";
import { lateralityCaption, type Laterality } from "../../lib/laterality";
import { formatWeight } from "../../lib/workout";
import { LateralityToggle } from "../LateralityToggle";
import { WheelPicker } from "./WheelPicker";
import { ChunkErrorBoundary, hasWebGL } from "./three/fallback";

const Dumbbell3D = lazy(() =>
  import("./three/Dumbbell3D").then((m) => ({ default: m.Dumbbell3D })),
);

interface DumbbellPickerProps {
  unit: Unit;
  value: number; // display unit, per dumbbell
  laterality: Laterality;
  onChange: (value: number) => void;
  onLateralityChange: (value: Laterality) => void;
}

const SVG_W = 200;
const SVG_H = 76;
const MID = SVG_H / 2;

/** Line-art dumbbell whose heads grow with the selected weight. */
function DumbbellIconSvg({ unit, value }: { unit: Unit; value: number }) {
  const sizes = DUMBBELL_SIZES[unit];
  const fraction = value / sizes[sizes.length - 1];
  const headH = Math.round(22 + 40 * Math.pow(fraction, 0.8));
  const headW = Math.round(10 + 8 * fraction);
  const innerH = Math.round(headH * 0.7);
  const gap = 3;
  const xL = 62;
  const xR = SVG_W - 62;

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="h-[88px] w-52"
      role="img"
      aria-label={`${formatWeight(value)} ${unit} dumbbell`}
    >
      {/* handle */}
      <line
        x1={xL}
        y1={MID}
        x2={xR}
        y2={MID}
        stroke="#d4d4d4"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* outer heads */}
      <rect
        x={xL - gap - headW}
        y={MID - headH / 2}
        width={headW}
        height={headH}
        rx="3"
        fill="#d4d4d4"
        fillOpacity={0.12 + 0.28 * fraction}
        stroke="#d4d4d4"
        strokeWidth="1.5"
      />
      <rect
        x={xR + gap}
        y={MID - headH / 2}
        width={headW}
        height={headH}
        rx="3"
        fill="#d4d4d4"
        fillOpacity={0.12 + 0.28 * fraction}
        stroke="#d4d4d4"
        strokeWidth="1.5"
      />
      {/* inner collars */}
      <rect
        x={xL - gap - headW - 3 - 4}
        y={MID - innerH / 2}
        width={4}
        height={innerH}
        rx="1.5"
        fill="none"
        stroke="#d4d4d4"
        strokeWidth="1.5"
      />
      <rect
        x={xR + gap + headW + 3}
        y={MID - innerH / 2}
        width={4}
        height={innerH}
        rx="1.5"
        fill="none"
        stroke="#d4d4d4"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function DumbbellIcon(props: { unit: Unit; value: number }) {
  const fallback = <DumbbellIconSvg {...props} />;
  if (!hasWebGL()) return fallback;
  return (
    <ChunkErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <Dumbbell3D {...props} />
      </Suspense>
    </ChunkErrorBoundary>
  );
}

export function DumbbellPicker({
  unit,
  value,
  laterality,
  onChange,
  onLateralityChange,
}: DumbbellPickerProps) {
  const caption = lateralityCaption(laterality, "independent");

  return (
    <div>
      <WheelPicker
        values={DUMBBELL_SIZES[unit]}
        value={value}
        onChange={onChange}
        format={formatWeight}
        ariaLabel={`Dumbbell weight (${unit})`}
      />
      <p className="mt-1 text-center text-sm text-muted" aria-live="polite">
        <span className="sr-only">{formatWeight(value)} </span>
        {unit} · {caption}
      </p>

      <div className="mt-4 flex justify-center">
        <DumbbellIcon unit={unit} value={value} />
      </div>

      <div className="mt-4 flex justify-center">
        <LateralityToggle
          value={laterality}
          onChange={onLateralityChange}
          variant="pair"
        />
      </div>
    </div>
  );
}
