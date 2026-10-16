import { useRef } from "react";

/** -1 zooms out, 0 fits the data, 1 zooms in. Each step doubles the scale. */
export function scaleFromZoom(zoom: number) {
  return 2 ** zoom;
}

/**
 * Window centered on the data, the way a graphing calculator scales one axis.
 * Scale 1 shows the series with a little air. Above 1 spreads it; below 1 packs it.
 */
export function scaledWindow(
  min: number,
  max: number,
  scale: number,
): [number, number] {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const mid = (lo + hi) / 2;
  const span = Math.max(hi - lo, Math.abs(mid) * 0.08, 1);
  const fitted = span * 1.22;
  const window = fitted / Math.max(scale, 0.05);
  return [mid - window / 2, mid + window / 2];
}

export function scaleLabel(zoom: number) {
  const scale = scaleFromZoom(zoom);
  const digits = scale >= 10 ? 0 : 1;
  return `${scale.toFixed(digits)}×`;
}

function zoomFromPointer(
  axis: "x" | "y",
  rect: DOMRect,
  clientX: number,
  clientY: number,
) {
  const span = axis === "x" ? rect.width : rect.height;
  if (span < 1) return 0;
  const ratio =
    axis === "x"
      ? (clientX - rect.left) / span
      : 1 - (clientY - rect.top) / span;
  return Math.min(1, Math.max(-1, ratio * 2 - 1));
}

export function AxisScale({
  axis,
  value,
  onChange,
  label,
}: {
  axis: "x" | "y";
  /** -1 zoom out, 0 fit, 1 zoom in. */
  value: number;
  onChange: (next: number) => void;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pct = (value + 1) / 2;
  const place =
    axis === "x"
      ? { left: `calc(0.625rem + (100% - 1.25rem) * ${pct})` }
      : { bottom: `calc(0.625rem + (100% - 1.25rem) * ${pct})` };

  const read = (clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return value;
    return zoomFromPointer(axis, el.getBoundingClientRect(), clientX, clientY);
  };

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-orientation={axis === "x" ? "horizontal" : "vertical"}
      aria-valuemin={-1}
      aria-valuemax={1}
      aria-valuenow={Number(value.toFixed(2))}
      aria-valuetext={scaleLabel(value)}
      className={
        axis === "x"
          ? "relative h-11 w-full cursor-pointer touch-none"
          : "relative h-[9.25rem] w-11 shrink-0 cursor-pointer self-start touch-none"
      }
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        onChange(read(e.clientX, e.clientY));
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        onChange(read(e.clientX, e.clientY));
      }}
      onPointerUp={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        const next = read(e.clientX, e.clientY);
        onChange(Math.abs(next) < 0.06 ? 0 : next);
      }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 0.25 : 0.1;
        if (e.key === "ArrowRight" || e.key === "ArrowUp") {
          e.preventDefault();
          onChange(Math.min(1, Number((value + step).toFixed(2))));
        } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
          e.preventDefault();
          onChange(Math.max(-1, Number((value - step).toFixed(2))));
        } else if (e.key === "Home" || e.key === "Escape") {
          e.preventDefault();
          onChange(0);
        } else if (e.key === "End") {
          e.preventDefault();
          onChange(1);
        }
      }}
    >
      <span
        className={
          axis === "x"
            ? "pointer-events-none absolute top-1/2 right-2.5 left-2.5 h-0.5 -translate-y-1/2 rounded-full bg-[var(--color-hairline)]"
            : "pointer-events-none absolute top-2.5 bottom-2.5 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-[var(--color-hairline)]"
        }
      />
      <span
        className={`pointer-events-none absolute size-5 rounded-full border-2 border-bg bg-ink shadow-[var(--shadow-float)] ${
          axis === "x"
            ? "top-1/2 -translate-x-1/2 -translate-y-1/2"
            : "left-1/2 -translate-x-1/2 translate-y-1/2"
        }`}
        style={place}
      />
    </div>
  );
}
