import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
} from "react";

export const SNAP_ITEM_W = 80;
const SNAP_ITEM_H = 56;

interface WheelPickerProps {
  values: number[];
  value: number;
  onChange: (value: number) => void;
  format?: (v: number) => string;
  ariaLabel: string;
}

/**
 * Horizontal snap picker. The selected value is the hero numeral; neighbors
 * peek at reduced scale so the control is the number, not a separate drum.
 * Native scroll-snap settles; a rAF loop paints opacity/scale without
 * re-rendering mid-flick.
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

  const paint = useCallback(() => {
    const wheel = wheelRef.current;
    if (!wheel) return;
    const centerIndex = wheel.scrollLeft / SNAP_ITEM_W;
    itemRefs.current.forEach((item, i) => {
      if (!item) return;
      const ad = Math.abs(i - centerIndex);
      item.style.opacity = String(Math.max(0.14, 1 - ad * 0.55));
      item.style.transform = reducedMotion
        ? ""
        : `scale(${Math.max(0.52, 1 - ad * 0.28)})`;
      const on = ad < 0.5;
      item.style.color = on ? "var(--color-ink)" : "var(--color-muted)";
      item.style.fontWeight = on ? "600" : "500";
    });
  }, [reducedMotion]);

  const handleScroll = useCallback(() => {
    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      const wheel = wheelRef.current;
      if (!wheel) return;
      paint();
      const index = Math.max(
        0,
        Math.min(values.length - 1, Math.round(wheel.scrollLeft / SNAP_ITEM_W)),
      );
      const next = values[index];
      if (next !== lastEmitted.current) {
        lastEmitted.current = next;
        onChange(next);
      }
    });
  }, [values, onChange, paint]);

  // Position when the value changes from outside (prefill, unit switch,
  // "same as last time"), never when the change came from a scroll.
  const knownValues = useRef<number[] | null>(null);
  useLayoutEffect(() => {
    const wheel = wheelRef.current;
    if (!wheel) return;
    const valuesChanged = knownValues.current !== values;
    if (!valuesChanged && value === lastEmitted.current) {
      paint();
      return;
    }
    knownValues.current = values;
    itemRefs.current.length = values.length;
    const index = Math.max(0, values.indexOf(value));
    lastEmitted.current = value;
    wheel.scrollTo({ left: index * SNAP_ITEM_W, behavior: "instant" });
    paint();
  }, [value, values, paint]);

  useEffect(() => () => cancelAnimationFrame(rafId.current), []);

  const selectIndex = (index: number) => {
    wheelRef.current?.scrollTo({
      left: index * SNAP_ITEM_W,
      behavior: reducedMotion ? "instant" : "smooth",
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const index = Math.max(0, values.indexOf(value));
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      if (index >= values.length - 1) return;
      e.preventDefault();
      selectIndex(index + 1);
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      if (index <= 0) return;
      e.preventDefault();
      selectIndex(index - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      selectIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      selectIndex(values.length - 1);
    }
  };

  const edge = `calc(50% - ${SNAP_ITEM_W / 2}px)`;

  return (
    <div
      ref={wheelRef}
      role="listbox"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      tabIndex={0}
      onScroll={handleScroll}
      onKeyDown={onKeyDown}
      className="snap-fade-x no-scrollbar relative flex snap-x snap-mandatory overflow-x-auto overscroll-contain select-none"
      style={{
        height: SNAP_ITEM_H,
        paddingLeft: edge,
        paddingRight: edge,
        touchAction: "pan-x",
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
          tabIndex={-1}
          aria-selected={v === value}
          onClick={() => selectIndex(i)}
          className="tnum box-border flex w-20 min-w-20 max-w-20 shrink-0 grow-0 snap-center items-center justify-center border-0 bg-transparent p-0 text-3xl tracking-tight touch-pan-x"
          style={{ height: SNAP_ITEM_H }}
        >
          {format(v)}
        </button>
      ))}
    </div>
  );
}
