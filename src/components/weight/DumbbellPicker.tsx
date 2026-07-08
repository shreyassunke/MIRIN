import { DUMBBELL_SIZES, type Unit } from "../../lib/units";
import { formatWeight } from "../../lib/workout";
import { WheelPicker } from "./WheelPicker";

interface DumbbellPickerProps {
  unit: Unit;
  value: number; // display unit, per dumbbell
  pair: boolean;
  onChange: (value: number) => void;
  onPairChange: (pair: boolean) => void;
}

const SVG_W = 200;
const SVG_H = 76;
const MID = SVG_H / 2;

/** Line-art dumbbell whose heads grow with the selected weight. */
function DumbbellIcon({ unit, value }: { unit: Unit; value: number }) {
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
      className="w-44"
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

export function DumbbellPicker({
  unit,
  value,
  pair,
  onChange,
  onPairChange,
}: DumbbellPickerProps) {
  return (
    <div>
      <div className="mb-1 flex justify-center">
        <DumbbellIcon unit={unit} value={value} />
      </div>

      <WheelPicker
        values={DUMBBELL_SIZES[unit]}
        value={value}
        onChange={onChange}
        format={formatWeight}
        ariaLabel={`Dumbbell weight (${unit})`}
      />

      <div className="mt-3 flex justify-center">
        <div
          role="group"
          aria-label="Dumbbell count"
          className="flex overflow-hidden rounded-md border border-hairline bg-surface"
        >
          <button
            type="button"
            aria-pressed={pair}
            onClick={() => onPairChange(true)}
            className={[
              "h-9 px-3 text-[13px] font-medium transition-colors duration-150",
              pair ? "bg-surface-raised text-ink" : "text-muted hover:text-ink",
            ].join(" ")}
          >
            Pair
          </button>
          <button
            type="button"
            aria-pressed={!pair}
            onClick={() => onPairChange(false)}
            className={[
              "h-9 px-3 text-[13px] font-medium transition-colors duration-150",
              !pair
                ? "bg-surface-raised text-ink"
                : "text-muted hover:text-ink",
            ].join(" ")}
          >
            Single arm
          </button>
        </div>
      </div>
    </div>
  );
}
