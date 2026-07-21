import { useState } from "react";
import {
  BAR_OPTIONS,
  PLATE_SIZES,
  plateColor,
  round2,
  type Unit,
} from "../../lib/units";
import { formatWeight } from "../../lib/workout";
import { Stepper } from "../Stepper";

interface BarbellPickerProps {
  unit: Unit;
  barWeight: number; // display unit
  plates: number[]; // per side, display unit, sorted descending
  onChange: (barWeight: number, plates: number[]) => void;
}

/** Chip diameter follows real plate size hierarchy. */
function chipDiameter(value: number, max: number) {
  return Math.round(30 + 26 * Math.sqrt(value / max));
}

/** SVG plate proportions: taller and slightly thicker for bigger plates. */
function plateDims(value: number, max: number) {
  return {
    h: Math.round(18 + 44 * Math.pow(value / max, 0.75)),
    w: Math.round(6 + 5 * (value / max)),
  };
}

const SVG_W = 320;
const SVG_H = 92;
const MID = SVG_H / 2;
const COLLAR_L = 96;
const COLLAR_R = SVG_W - COLLAR_L;

function LoadedBar({
  unit,
  plates,
  onRemove,
}: {
  unit: Unit;
  plates: number[];
  onRemove: (index: number) => void;
}) {
  const max = PLATE_SIZES[unit][0];
  // Innermost plate sits against the collar; stacks grow outward.
  let cursor = 0;
  const placed = plates.map((value, index) => {
    const { h, w } = plateDims(value, max);
    const offset = cursor;
    cursor += w + 3;
    return { value, index, h, w, offset };
  });

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="w-full max-w-80"
      role="img"
      aria-label={
        plates.length
          ? `Bar loaded with ${plates.map((p) => formatWeight(p)).join(", ")} per side`
          : "Empty bar"
      }
    >
      {/* bar */}
      <line
        x1="6"
        y1={MID}
        x2={SVG_W - 6}
        y2={MID}
        stroke="#d4d4d4"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* collars */}
      <line
        x1={COLLAR_L}
        y1={MID - 9}
        x2={COLLAR_L}
        y2={MID + 9}
        stroke="#d4d4d4"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <line
        x1={COLLAR_R}
        y1={MID - 9}
        x2={COLLAR_R}
        y2={MID + 9}
        stroke="#d4d4d4"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {placed.map(({ value, index, h, w, offset }) => {
        const color = plateColor(unit, value);
        const xLeft = COLLAR_L - 4 - offset - w;
        const xRight = COLLAR_R + 4 + offset;
        return (
          <g key={index}>
            {/* left side: tappable to remove; right side mirrors it */}
            <rect
              x={xLeft}
              y={MID - h / 2}
              width={w}
              height={h}
              rx="2"
              fill={color}
              fillOpacity="0.2"
              stroke={color}
              strokeWidth="1.5"
              className="cursor-pointer"
              role="button"
              aria-label={`Remove ${formatWeight(value)} ${unit} plate`}
              onClick={() => onRemove(index)}
            />
            <rect
              x={xRight}
              y={MID - h / 2}
              width={w}
              height={h}
              rx="2"
              fill={color}
              fillOpacity="0.2"
              stroke={color}
              strokeWidth="1.5"
              className="cursor-pointer"
              aria-hidden="true"
              onClick={() => onRemove(index)}
            />
          </g>
        );
      })}
    </svg>
  );
}

export function BarbellPicker({
  unit,
  barWeight,
  plates,
  onChange,
}: BarbellPickerProps) {
  const bars = BAR_OPTIONS[unit];
  // Explicit user choice; a nonstandard bar weight also opens the stepper.
  const [customChosen, setCustomChosen] = useState(false);
  const customBar = customChosen || !bars.includes(barWeight);
  const max = PLATE_SIZES[unit][0];

  const counts = new Map<number, number>();
  for (const p of plates) counts.set(p, (counts.get(p) ?? 0) + 1);

  const addPlate = (value: number) =>
    onChange(barWeight, [...plates, value].sort((a, b) => b - a));

  const removePlate = (index: number) =>
    onChange(
      barWeight,
      plates.filter((_, i) => i !== index),
    );

  return (
    <div>
      {/* Bar selection */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-[13px] font-medium text-muted">Bar</span>
        <div className="glass flex gap-0.5 rounded-pill p-0.5">
          {bars.map((bar) => (
            <button
              key={bar}
              type="button"
              aria-pressed={!customBar && barWeight === bar}
              onClick={() => {
                setCustomChosen(false);
                onChange(bar, plates);
              }}
              className={[
                "glass-chip tnum h-9 rounded-pill px-3 text-[13px] font-medium",
                !customBar && barWeight === bar
                  ? "glass-chip-active text-ink"
                  : "text-muted hover:text-ink",
              ].join(" ")}
            >
              {formatWeight(bar)} {unit}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={customBar}
            onClick={() => setCustomChosen(true)}
            className={[
              "glass-chip h-9 rounded-pill px-3 text-[13px] font-medium",
              customBar
                ? "glass-chip-active text-ink"
                : "text-muted hover:text-ink",
            ].join(" ")}
          >
            Custom
          </button>
        </div>
      </div>

      {customBar && (
        <div className="mb-4 flex justify-center">
          <Stepper
            label={`Bar weight (${unit})`}
            value={barWeight}
            step={unit === "lb" ? 5 : 2.5}
            min={0}
            onChange={(v) => onChange(v, plates)}
          />
        </div>
      )}

      {/* Live loaded bar */}
      <div className="mb-1 flex justify-center">
        <LoadedBar unit={unit} plates={plates} onRemove={removePlate} />
      </div>
      <p className="mb-3 text-center text-[12px] text-muted">
        {plates.length
          ? "Tap a plate on the bar to remove it"
          : "Empty bar — add plates below"}
      </p>

      {/* Plate chips */}
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-muted">
          Plates per side
        </span>
        {plates.length > 0 && (
          <button
            type="button"
            onClick={() => onChange(barWeight, [])}
            className="text-[13px] font-medium text-muted transition-colors duration-150 hover:text-ink"
          >
            Clear
          </button>
        )}
      </div>
      <div className="-mx-1 flex items-end gap-1 overflow-x-auto px-1 pb-1">
        {PLATE_SIZES[unit].map((value) => {
          const d = chipDiameter(value, max);
          const color = plateColor(unit, value);
          const count = counts.get(value) ?? 0;
          return (
            <button
              key={value}
              type="button"
              onClick={() => addPlate(value)}
              aria-label={`Add ${formatWeight(value)} ${unit} plate to each side`}
              className="flex min-w-14 shrink-0 flex-col items-center gap-1 rounded-md py-1.5 transition-colors duration-150 hover:bg-surface-raised"
            >
              <span
                className="tnum flex items-center justify-center rounded-full border text-[12px] font-semibold text-ink"
                style={{
                  width: d,
                  height: d,
                  borderColor: color,
                  backgroundColor: `${color}26`,
                }}
              >
                {formatWeight(value)}
              </span>
              <span className="tnum h-4 text-[11px] text-muted">
                {count > 0 ? `×${count}` : ""}
              </span>
            </button>
          );
        })}
      </div>
      {plates.length > 0 && (
        <p className="tnum mt-1 text-center text-[12px] text-muted">
          {formatWeight(round2(plates.reduce((a, b) => a + b, 0)))} {unit} per
          side
        </p>
      )}
    </div>
  );
}
