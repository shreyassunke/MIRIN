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
      className="flex overflow-hidden rounded-md border border-hairline bg-surface"
    >
      {UNITS.map((u) => (
        <button
          key={u}
          type="button"
          aria-pressed={unit === u}
          onClick={() => setUnit(u)}
          className={[
            "h-9 px-3 text-[13px] font-medium transition-colors duration-150",
            unit === u
              ? "bg-surface-raised text-ink"
              : "text-muted hover:text-ink",
          ].join(" ")}
        >
          {u}
        </button>
      ))}
    </div>
  );
}
