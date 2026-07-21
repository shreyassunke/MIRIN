import { useUnit } from "../lib/settings";
import type { Unit } from "../lib/units";

const UNITS: Unit[] = ["lb", "kg"];

/** The persistent global lb/kg switch. */
export function UnitToggle() {
  const [unit, setUnit] = useUnit();
  return (
    <div
      role="group"
      aria-label="Weight unit"
      className="glass flex overflow-hidden rounded-pill p-0.5"
    >
      {UNITS.map((u) => (
        <button
          key={u}
          type="button"
          aria-pressed={unit === u}
          onClick={() => setUnit(u)}
          className={[
            "h-9 min-w-10 rounded-pill px-3 text-[13px] font-medium transition-[background-color,color] duration-150 ease-[var(--ease-out-quint)]",
            unit === u
              ? "bg-glass-highlight text-ink"
              : "text-muted hover:text-ink",
          ].join(" ")}
        >
          {u}
        </button>
      ))}
    </div>
  );
}
