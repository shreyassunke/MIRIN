import {
  lazy,
  Suspense,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  BAR_OPTIONS,
  PLATE_SIZES,
  plateColor,
  round2,
  type Unit,
} from "../../lib/units";
import { formatWeight } from "../../lib/workout";
import { useDismissOnPointerOutside } from "../../hooks/useDismissOnPointerOutside";
import { chipClass, chipTrackClass } from "../chip";
import { Stepper } from "../Stepper";
import { ChunkErrorBoundary, hasWebGL } from "./three/fallback";
import { PlateRack } from "./PlateRack";

const LoadedBar3D = lazy(() =>
  import("./three/LoadedBar3D").then((m) => ({ default: m.LoadedBar3D })),
);

interface BarbellPickerProps {
  unit: Unit;
  barWeight: number; // display unit
  plates: number[]; // per side, display unit, sorted descending
  onChange: (barWeight: number, plates: number[]) => void;
}

/** SVG plate proportions: taller and slightly thicker for bigger plates. */
function plateDims(value: number, max: number) {
  return {
    h: Math.round(18 + 44 * Math.pow(value / max, 0.75)),
    w: Math.round(10 + 8 * (value / max)),
  };
}

const SVG_W = 320;
const SVG_H = 92;
const MID = SVG_H / 2;
const BAR_STAGE_H = 104;
const PLATE_HIT = 44;
const COLLAR_L = 96;
const COLLAR_R = SVG_W - COLLAR_L;

function LoadedBarSvg({
  unit,
  plates,
  onRemove,
}: {
  unit: Unit;
  plates: number[];
  onRemove: (index: number) => void;
}) {
  const max = PLATE_SIZES[unit][0];
  const barMaskId = `bar-mask${useId().replaceAll(":", "")}`;
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
      className="w-full"
      style={{ height: BAR_STAGE_H }}
      role="img"
      aria-label={
        plates.length
          ? `Bar loaded with ${plates.map((p) => formatWeight(p)).join(", ")} per side`
          : "Empty bar"
      }
    >
      <defs>
        {/* Punch the plate interiors out of the bar so the sleeve never
            draws through a plate — the outline is the plate, not a tint
            sitting on top of the shaft. */}
        <mask
          id={barMaskId}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width={SVG_W}
          height={SVG_H}
        >
          <rect width={SVG_W} height={SVG_H} fill="white" />
          {placed.map(({ index, h, w, offset }) => {
            const xLeft = COLLAR_L - 4 - offset - w;
            const xRight = COLLAR_R + 4 + offset;
            return (
              <g key={index}>
                <rect
                  x={xLeft}
                  y={MID - h / 2}
                  width={w}
                  height={h}
                  rx="2"
                  fill="black"
                />
                <rect
                  x={xRight}
                  y={MID - h / 2}
                  width={w}
                  height={h}
                  rx="2"
                  fill="black"
                />
              </g>
            );
          })}
        </mask>
      </defs>
      {/* bar */}
      <line
        x1="6"
        y1={MID}
        x2={SVG_W - 6}
        y2={MID}
        stroke="#d4d4d4"
        strokeWidth="2"
        strokeLinecap="round"
        mask={`url(#${barMaskId})`}
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
        const hitW = Math.max(w, PLATE_HIT);
        const hitH = Math.max(h, PLATE_HIT);
        const hit = (x: number, labelled: boolean) => (
          <>
            <rect
              x={x + w / 2 - hitW / 2}
              y={MID - hitH / 2}
              width={hitW}
              height={hitH}
              fill="transparent"
              className="cursor-pointer"
              role={labelled ? "button" : undefined}
              aria-label={
                labelled
                  ? `Remove ${formatWeight(value)} ${unit} plate`
                  : undefined
              }
              aria-hidden={labelled ? undefined : true}
              onClick={() => onRemove(index)}
            />
            <rect
              x={x}
              y={MID - h / 2}
              width={w}
              height={h}
              rx="2"
              fill={color}
              fillOpacity="0.2"
              stroke={color}
              strokeWidth="1.5"
              pointerEvents="none"
            />
          </>
        );
        return (
          <g key={index}>
            {hit(xLeft, true)}
            {hit(xRight, false)}
          </g>
        );
      })}
    </svg>
  );
}

function LoadedBar(props: {
  unit: Unit;
  plates: number[];
  onRemove: (index: number) => void;
}) {
  const fallback = <LoadedBarSvg {...props} />;
  if (!hasWebGL()) return fallback;
  return (
    <ChunkErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <LoadedBar3D {...props} />
      </Suspense>
    </ChunkErrorBoundary>
  );
}

function Chevron() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="ml-1 inline h-3.5 w-3.5 text-muted"
      aria-hidden="true"
    >
      <path
        d="M4 6.5 8 10.5 12 6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
  const listId = useId();
  // Explicit user choice; a nonstandard bar weight also opens the stepper.
  const [customChosen, setCustomChosen] = useState(false);
  const [pickingBar, setPickingBar] = useState(false);
  const customBar = customChosen || !bars.includes(barWeight);
  const plateSum = round2(plates.reduce((a, b) => a + b, 0));
  const total = round2(barWeight + 2 * plateSum);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const wasPicking = useRef(false);

  useDismissOnPointerOutside(
    pickerRef,
    () => setPickingBar(false),
    pickingBar,
  );

  useEffect(() => {
    if (!pickingBar) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPickingBar(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pickingBar]);

  useLayoutEffect(() => {
    if (pickingBar) {
      pickerRef.current
        ?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
        ?.focus();
    } else if (wasPicking.current) {
      triggerRef.current?.focus();
    }
    wasPicking.current = pickingBar;
  }, [pickingBar]);

  const counts = new Map<number, number>();
  for (const p of plates) counts.set(p, (counts.get(p) ?? 0) + 1);

  const addPlate = (value: number) =>
    onChange(barWeight, [...plates, value].sort((a, b) => b - a));

  const removePlate = (index: number) =>
    onChange(
      barWeight,
      plates.filter((_, i) => i !== index),
    );

  const pickBar = (bar: number) => {
    setCustomChosen(false);
    setPickingBar(false);
    onChange(bar, plates);
  };

  return (
    <div>
      <div ref={pickerRef} className="mb-4 text-center">
        <div className="flex min-h-11 flex-col items-center justify-center">
          {pickingBar && plates.length > 0 && (
            <p className="mb-2">
              <span className="tnum text-3xl font-semibold tracking-tight">
                {formatWeight(total)}
              </span>
              <span className="ml-1.5 text-sm text-muted">{unit}</span>
            </p>
          )}
          {pickingBar ? (
            <div
              id={listId}
              role="group"
              aria-label="Bar weight"
              className={chipTrackClass}
            >
              {bars.map((bar) => (
                <button
                  key={bar}
                  type="button"
                  aria-pressed={!customBar && barWeight === bar}
                  onClick={() => pickBar(bar)}
                  className={`${chipClass(!customBar && barWeight === bar)} tnum h-11 px-3 text-[13px]`}
                >
                  {formatWeight(bar)} {unit}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={customBar}
                onClick={() => setCustomChosen(true)}
                className={`${chipClass(customBar)} h-11 px-3 text-[13px]`}
              >
                Custom
              </button>
            </div>
          ) : (
            <button
              ref={triggerRef}
              type="button"
              aria-expanded={false}
              aria-haspopup="true"
              aria-controls={listId}
              aria-label={`Total ${formatWeight(total)} ${unit}. Bar ${formatWeight(barWeight)} ${unit}. Change bar.`}
              aria-live="polite"
              onClick={() => setPickingBar(true)}
              className="inline-flex min-h-11 items-center rounded-pill px-3"
            >
              <span className="tnum text-3xl font-semibold tracking-tight">
                {formatWeight(total)}
              </span>
              <span className="ml-1.5 text-sm text-muted">{unit}</span>
              <Chevron />
            </button>
          )}
        </div>
        {plates.length > 0 && !pickingBar && (
          <p className="tnum mt-0.5 text-[13px] text-muted">
            {formatWeight(barWeight)} bar + 2 × {formatWeight(plateSum)}
          </p>
        )}
        {customBar && (
          <div className="mt-3 flex justify-center">
            <Stepper
              label={`Bar weight (${unit})`}
              value={barWeight}
              step={unit === "lb" ? 5 : 2.5}
              min={0}
              onChange={(v) => onChange(v, plates)}
            />
          </div>
        )}
      </div>

      {/* Live loaded bar */}
      <div className="mb-1 flex justify-center">
        <LoadedBar unit={unit} plates={plates} onRemove={removePlate} />
      </div>
      <p className="mb-3 text-center text-[13px] text-muted">
        {plates.length
          ? "Tap a plate to remove it"
          : "Empty bar — add plates below"}
      </p>

      {/* Plate chips */}
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-muted">
          Plates per side
        </span>
        {plates.length > 0 && (
          <button
            type="button"
            onClick={() => onChange(barWeight, [])}
            className="glass-btn h-11 rounded-pill px-3 text-[13px] font-medium text-muted hover:text-ink"
          >
            Clear
          </button>
        )}
      </div>
      <PlateRack unit={unit} counts={counts} onAdd={addPlate} />
    </div>
  );
}
