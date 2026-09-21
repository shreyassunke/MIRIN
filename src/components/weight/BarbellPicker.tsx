import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  BAR_OPTIONS,
  round2,
  type Unit,
} from "../../lib/units";
import { formatWeight } from "../../lib/workout";
import { Stepper } from "../Stepper";
import { ChunkErrorBoundary, hasWebGL } from "./three/fallback";
import { PlateRack } from "./PlateRack";

const loadBar3D = () =>
  import("./three/LoadedBar3D").then((m) => ({ default: m.LoadedBar3D }));
const LoadedBar3D = lazy(loadBar3D);
void loadBar3D();

interface BarbellPickerProps {
  unit: Unit;
  barWeight: number; // display unit
  plates: number[]; // per side, display unit, sorted descending
  onChange: (barWeight: number, plates: number[]) => void;
}

const BAR_STAGE_H = 104;

function BarStageFallback() {
  return <div className="w-full" style={{ height: BAR_STAGE_H }} />;
}

function LoadedBar({
  live = true,
  ...props
}: {
  unit: Unit;
  plates: number[];
  onRemove: (index: number) => void;
  live?: boolean;
  onSwipe?: (direction: -1 | 1) => void;
}) {
  const fallback = <BarStageFallback />;
  if (!hasWebGL()) return fallback;
  return (
    <ChunkErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <LoadedBar3D {...props} live={live} />
      </Suspense>
    </ChunkErrorBoundary>
  );
}

const BAR_MENU_WIDTH = 184;
const BAR_MENU_PAD = 8;

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={[
        "ml-1 h-4 w-4 shrink-0 text-muted transition-transform duration-150 motion-reduce:transition-none",
        open ? "rotate-180" : "",
      ].join(" ")}
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

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        d="M6.5 12.25 10.2 16l7.3-8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BarWeightControl({
  unit,
  barWeight,
  plates,
  onChange,
}: BarbellPickerProps) {
  const bars = BAR_OPTIONS[unit];
  const triggerId = useId();
  const listId = useId();
  const [customChosen, setCustomChosen] = useState(false);
  const [open, setOpen] = useState(false);
  const customBar = customChosen || !bars.includes(barWeight);
  const plateSum = round2(plates.reduce((a, b) => a + b, 0));
  const total = round2(barWeight + 2 * plateSum);
  const options = [
    ...bars.map((bar) => ({
      id: `bar-${bar}`,
      label: `${formatWeight(bar)} ${unit}`,
      selected: !customBar && barWeight === bar,
      bar,
    })),
    { id: "custom", label: "Custom", selected: customBar, bar: null },
  ];

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const wasOpen = useRef(false);
  const [coords, setCoords] = useState({
    top: 0,
    left: 0,
    origin: "top center",
  });

  const close = useCallback(() => setOpen(false), []);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;
    const rect = trigger.getBoundingClientRect();
    const menuH = menu.offsetHeight;
    const menuW = Math.max(BAR_MENU_WIDTH, menu.offsetWidth);
    const left = Math.min(
      Math.max(BAR_MENU_PAD, rect.left + rect.width / 2 - menuW / 2),
      window.innerWidth - menuW - BAR_MENU_PAD,
    );
    const below = rect.bottom + 6;
    const above = rect.top - menuH - 6;
    const fitsBelow = below + menuH <= window.innerHeight - BAR_MENU_PAD;
    const top = fitsBelow ? below : Math.max(BAR_MENU_PAD, above);
    setCoords({
      top,
      left,
      origin: fitsBelow ? "top center" : "bottom center",
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
  }, [open, options.length, place]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        triggerRef.current?.focus();
      }
    };
    const onReposition = () => close();
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, close]);

  useLayoutEffect(() => {
    if (open) {
      menuRef.current
        ?.querySelector<HTMLButtonElement>('[aria-selected="true"]')
        ?.focus();
    } else if (wasOpen.current) {
      triggerRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  const pickBar = (bar: number) => {
    setCustomChosen(false);
    close();
    onChange(bar, plates);
  };

  const pickCustom = () => {
    setCustomChosen(true);
    close();
  };

  function focusItem(delta: number) {
    if (options.length === 0) return;
    const current = itemRefs.current.findIndex(
      (el) => el === document.activeElement,
    );
    const next = (current + delta + options.length) % options.length;
    itemRefs.current[next]?.focus();
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      itemRefs.current[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      itemRefs.current[options.length - 1]?.focus();
    }
  }

  return (
    <div className="text-center">
      <div className="flex min-h-11 flex-col items-center justify-center">
        <button
          ref={triggerRef}
          type="button"
          id={triggerId}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={open ? listId : undefined}
          aria-label={`Total ${formatWeight(total)} ${unit}. Bar ${formatWeight(barWeight)} ${unit}. Change bar.`}
          onClick={() => setOpen((value) => !value)}
          className="inline-flex min-h-11 items-center rounded-md px-3"
        >
          <span className="tnum text-3xl font-semibold tracking-tight">
            {formatWeight(total)}
          </span>
          <span className="ml-1.5 text-sm text-muted">{unit}</span>
          <Chevron open={open} />
        </button>
      </div>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={listId}
            role="listbox"
            aria-label="Bar weight"
            onKeyDown={onMenuKeyDown}
            style={{
              top: coords.top,
              left: coords.left,
              width: BAR_MENU_WIDTH,
              transformOrigin: coords.origin,
            }}
            className="overflow-menu fixed z-50 rounded-xl p-1.5 shadow-glass glass"
          >
            {options.map((option, index) => (
              <button
                key={option.id}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                type="button"
                role="option"
                id={`${listId}-${option.id}`}
                aria-selected={option.selected}
                onClick={() =>
                  option.bar == null ? pickCustom() : pickBar(option.bar)
                }
                className={[
                  "flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-[15px] font-medium transition-colors duration-150 motion-reduce:transition-none",
                  option.selected
                    ? "bg-[rgb(250_250_250/0.08)] text-ink"
                    : "text-ink hover:bg-[rgb(250_250_250/0.08)]",
                  option.id !== "custom" ? "tnum" : "",
                ].join(" ")}
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.selected ? (
                  <span className="shrink-0 text-muted">
                    <IconCheck />
                  </span>
                ) : null}
              </button>
            ))}
          </div>,
          document.body,
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
  );
}

export function BarbellRack({
  unit,
  barWeight,
  plates,
  onChange,
}: BarbellPickerProps) {
  const counts = new Map<number, number>();
  for (const p of plates) counts.set(p, (counts.get(p) ?? 0) + 1);

  return (
    <div>
      <p className="mb-1 text-center text-[13px] text-muted">
        {plates.length
          ? "Tap a plate to remove it"
          : "Empty bar — add plates below"}
      </p>
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
      <PlateRack
        unit={unit}
        counts={counts}
        onAdd={(value) =>
          onChange(barWeight, [...plates, value].sort((a, b) => b - a))
        }
      />
    </div>
  );
}

export function BarbellPicker({
  unit,
  barWeight,
  plates,
  onChange,
  live = true,
  onSwipe,
}: BarbellPickerProps & {
  live?: boolean;
  onSwipe?: (direction: -1 | 1) => void;
}) {
  const removePlate = (index: number) =>
    onChange(
      barWeight,
      plates.filter((_, i) => i !== index),
    );

  return (
    <div className="flex justify-center">
      <LoadedBar
        unit={unit}
        plates={plates}
        onRemove={removePlate}
        live={live}
        onSwipe={onSwipe}
      />
    </div>
  );
}
