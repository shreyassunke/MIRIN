import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

export const CHART_READINGS = [
  { id: "line", label: "Line", short: "Line" },
  { id: "area", label: "Area under curve", short: "Area" },
  { id: "trend", label: "Trend line", short: "Trend" },
] as const;

export type ChartReadingId = (typeof CHART_READINGS)[number]["id"];

const STORAGE_KEY = "mirin.chart.reading";

export function readChartReading(): ChartReadingId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return CHART_READINGS.find((item) => item.id === raw)?.id ?? "line";
  } catch {
    return "line";
  }
}

export function storeChartReading(id: ChartReadingId) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // The reading still applies for this visit.
  }
}

export function ChartReading({
  value,
  onChange,
}: {
  value: ChartReadingId;
  onChange: (next: ChartReadingId) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const listId = useId();
  const current = CHART_READINGS.find((item) => item.id === value) ?? CHART_READINGS[0];

  useEffect(() => {
    if (!open) return;
    const index = CHART_READINGS.findIndex((item) => item.id === value);
    itemRefs.current[index]?.focus();
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (rootRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const move = (index: number) => {
    const next = CHART_READINGS[index];
    if (!next) return;
    onChange(next.id);
    itemRefs.current[index]?.focus();
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = CHART_READINGS.findIndex((item) => item.id === value);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move((index + 1) % CHART_READINGS.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move((index - 1 + CHART_READINGS.length) % CHART_READINGS.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      move(0);
    } else if (event.key === "End") {
      event.preventDefault();
      move(CHART_READINGS.length - 1);
    }
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Chart, ${current.label}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((next) => !next)}
        className="glass-btn inline-flex h-11 items-center gap-1.5 rounded-pill px-3.5 text-sm font-medium text-ink"
      >
        <span>{current.short}</span>
        <Chevron open={open} />
      </button>
      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-label="Chart"
          onKeyDown={onMenuKeyDown}
          className="quiet-menu overflow-menu absolute right-0 top-[calc(100%+0.5rem)] z-30 w-52 rounded-xl"
        >
          {CHART_READINGS.map((item, index) => {
            const selected = item.id === value;
            return (
              <button
                key={item.id}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                type="button"
                role="option"
                aria-selected={selected}
                data-current={selected ? "" : undefined}
                onClick={() => {
                  onChange(item.id);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                className="quiet-menu-item"
              >
                <span className="min-w-0 flex-1">{item.label}</span>
                {selected ? <CheckIcon /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={[
        "h-4 w-4 shrink-0 text-muted transition-transform duration-150 motion-reduce:transition-none",
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

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-muted" aria-hidden="true">
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
