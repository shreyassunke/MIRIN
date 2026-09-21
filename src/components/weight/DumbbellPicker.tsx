import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { DUMBBELL_SIZES, type Unit } from "../../lib/units";
import type { Laterality } from "../../lib/laterality";
import { formatWeight } from "../../lib/workout";
import { ChunkErrorBoundary, hasWebGL } from "./three/fallback";

const TAP_PX = 12;

const Dumbbell3D = lazy(() =>
  import("./three/Dumbbell3D").then((m) => ({ default: m.Dumbbell3D })),
);

const STEP_PX = 36;
const SWIPE_PX = 40;

interface DumbbellPickerProps {
  unit: Unit;
  value: number;
  laterality: Laterality;
  onChange: (value: number) => void;
  onToggleLaterality: () => void;
  live?: boolean;
  onSwipe?: (direction: -1 | 1) => void;
}

const SVG_W = 200;
const SVG_H = 76;
const MID = SVG_H / 2;

/** Line-art dumbbell whose heads grow with the selected weight. */
function DumbbellIconSvg({
  unit,
  value,
  compact,
}: {
  unit: Unit;
  value: number;
  compact?: boolean;
}) {
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
      className={compact ? "h-14 w-36" : "h-[88px] w-52"}
      aria-hidden="true"
    >
      <line
        x1={xL}
        y1={MID}
        x2={xR}
        y2={MID}
        stroke="#d4d4d4"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
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

function stepValue(unit: Unit, value: number, delta: number): number {
  const sizes = DUMBBELL_SIZES[unit];
  const current = sizes.indexOf(value);
  const index = current < 0 ? 0 : current;
  return sizes[Math.max(0, Math.min(sizes.length - 1, index + delta))];
}

function SvgRack({
  unit,
  value,
  pair,
  onChange,
  onToggleLaterality,
  onSwipe,
}: {
  unit: Unit;
  value: number;
  pair: boolean;
  onChange: (value: number) => void;
  onToggleLaterality: () => void;
  onSwipe?: (direction: -1 | 1) => void;
}) {
  const drag = useRef<{
    x: number;
    y: number;
    pointerId: number;
    captured: boolean;
    discarded: boolean;
    kind?: "step" | "swipe";
    last: number;
  } | null>(null);

  useEffect(() => {
    const clear = (event: globalThis.PointerEvent) => {
      const start = drag.current;
      if (!start || start.pointerId !== event.pointerId || start.captured) return;
      drag.current = null;
    };
    window.addEventListener("pointerup", clear);
    window.addEventListener("pointercancel", clear);
    return () => {
      window.removeEventListener("pointerup", clear);
      window.removeEventListener("pointercancel", clear);
    };
  }, []);

  const onPointerDown = (e: PointerEvent) => {
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      pointerId: e.pointerId,
      captured: false,
      discarded: false,
      last: value,
    };
  };

  const onPointerMove = (e: PointerEvent) => {
    const start = drag.current;
    if (!start || start.discarded) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!start.captured) {
      if (Math.hypot(dx, dy) <= TAP_PX) return;
      if (Math.abs(dy) >= Math.abs(dx)) {
        start.captured = true;
        start.kind = "step";
        start.y = e.clientY;
        e.currentTarget.setPointerCapture(e.pointerId);
      } else if (onSwipe) {
        start.captured = true;
        start.kind = "swipe";
        e.currentTarget.setPointerCapture(e.pointerId);
      } else {
        start.discarded = true;
      }
      return;
    }
    if (start.kind !== "step") return;
    e.preventDefault();
    let remain = e.clientY - start.y;
    while (Math.abs(remain) >= STEP_PX) {
      const dir = remain > 0 ? 1 : -1;
      const next = stepValue(unit, start.last, -dir);
      if (next !== start.last) {
        start.last = next;
        onChange(next);
      }
      start.y += dir * STEP_PX;
      remain = e.clientY - start.y;
    }
  };

  const end = (e: PointerEvent) => {
    const start = drag.current;
    drag.current = null;
    if (!start) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (start.kind === "swipe" && onSwipe) {
      const travel = e.clientX - start.x;
      if (Math.abs(travel) >= SWIPE_PX) {
        onSwipe((travel < 0 ? 1 : -1) as -1 | 1);
      }
      return;
    }
    if (start.captured || start.discarded) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > TAP_PX) return;
    onToggleLaterality();
  };

  return (
    <div
      className="flex h-36 cursor-ns-resize flex-col items-center justify-center gap-2"
      style={{ touchAction: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <DumbbellIconSvg unit={unit} value={value} compact={pair} />
      {pair && <DumbbellIconSvg unit={unit} value={value} compact />}
    </div>
  );
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
  const fallback = <SvgRack {...props} />;
  if (!live || !hasWebGL()) return fallback;
  return (
    <ChunkErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <Dumbbell3D
          unit={props.unit}
          value={props.value}
          pair={props.pair}
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
      aria-valuetext={`${formatWeight(value)} ${unit}, ${pair ? "pair" : "single"}`}
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
