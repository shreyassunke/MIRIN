import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

const ITEM_H = 36;
const VISIBLE = 5;
const WHEEL_H = ITEM_H * VISIBLE;
const MAX_TILT_ITEMS = 3;

interface WheelPickerProps {
  values: number[];
  value: number;
  onChange: (value: number) => void;
  format?: (v: number) => string;
  ariaLabel: string;
}

/**
 * iOS-timer-style drum picker. Scrolling is native (CSS scroll-snap does
 * the settling), while a rAF loop applies the rotateX/opacity drum effect
 * with direct style writes so nothing re-renders mid-flick.
 */
export function WheelPicker({
  values,
  value,
  onChange,
  format = String,
  ariaLabel,
}: WheelPickerProps) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const rafId = useRef(0);
  const lastEmitted = useRef<number | null>(null);
  const reducedMotion = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  ).current;

  const paintDrum = useCallback(() => {
    const wheel = wheelRef.current;
    if (!wheel) return;
    const centerIndex = wheel.scrollTop / ITEM_H;
    itemRefs.current.forEach((item, i) => {
      if (!item) return;
      const distance = i - centerIndex;
      const clamped = Math.max(-MAX_TILT_ITEMS, Math.min(MAX_TILT_ITEMS, distance));
      item.style.opacity = String(Math.max(0.2, 1 - Math.abs(clamped) * 0.28));
      item.style.transform = reducedMotion
        ? ""
        : `rotateX(${clamped * -16}deg) scale(${1 - Math.abs(clamped) * 0.05})`;
    });
  }, [reducedMotion]);

  const handleScroll = useCallback(() => {
    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      const wheel = wheelRef.current;
      if (!wheel) return;
      paintDrum();
      const index = Math.max(
        0,
        Math.min(values.length - 1, Math.round(wheel.scrollTop / ITEM_H)),
      );
      const next = values[index];
      if (next !== lastEmitted.current) {
        lastEmitted.current = next;
        onChange(next);
      }
    });
  }, [values, onChange, paintDrum]);

  // Position the drum when the value changes from outside (prefill, unit
  // switch, "same as last time"), never when the change came from a scroll.
  const knownValues = useRef<number[] | null>(null);
  useLayoutEffect(() => {
    const wheel = wheelRef.current;
    if (!wheel) return;
    const valuesChanged = knownValues.current !== values;
    if (!valuesChanged && value === lastEmitted.current) return;
    knownValues.current = values;
    itemRefs.current.length = values.length;
    const index = Math.max(0, values.indexOf(value));
    lastEmitted.current = value;
    wheel.scrollTo({ top: index * ITEM_H, behavior: "instant" });
    paintDrum();
  }, [value, values, paintDrum]);

  useEffect(() => () => cancelAnimationFrame(rafId.current), []);

  const selectIndex = (index: number) => {
    wheelRef.current?.scrollTo({
      top: index * ITEM_H,
      behavior: reducedMotion ? "instant" : "smooth",
    });
  };

  return (
    <div className="relative mx-auto w-36" style={{ perspective: "640px" }}>
      {/* center row indicator */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-9 -translate-y-1/2 rounded-md border border-hairline bg-surface-raised/40"
      />
      <div
        ref={wheelRef}
        role="listbox"
        aria-label={ariaLabel}
        onScroll={handleScroll}
        className="no-scrollbar relative snap-y snap-mandatory overflow-y-auto overscroll-contain"
        style={{
          height: WHEEL_H,
          paddingTop: ITEM_H * 2,
          paddingBottom: ITEM_H * 2,
          transformStyle: "preserve-3d",
        }}
      >
        {values.map((v, i) => (
          <button
            key={v}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            type="button"
            role="option"
            aria-selected={v === value}
            onClick={() => selectIndex(i)}
            className={[
              "tnum flex w-full snap-center items-center justify-center text-lg transition-colors duration-150",
              v === value ? "font-semibold text-ink" : "font-normal text-muted",
            ].join(" ")}
            style={{ height: ITEM_H }}
          >
            {format(v)}
          </button>
        ))}
      </div>
    </div>
  );
}
