import { useLengthUnit, useUnit } from "../lib/settings";
import type { LengthUnit } from "../lib/units";
import { chipClass, chipTrackClass } from "./chip";

const LENGTH_UNITS: LengthUnit[] = ["in", "cm"];

const sizeClass = "h-9 min-w-10 px-3 text-[13px]";

/** One unit at a time. A tap swaps pounds and kilograms. */
export function UnitToggle() {
  const [unit, setUnit] = useUnit();
  const next = unit === "lb" ? "kg" : "lb";
  return (
    <button
      type="button"
      aria-label={
        unit === "lb"
          ? "Pounds. Switch to kilograms."
          : "Kilograms. Switch to pounds."
      }
      onClick={() => setUnit(next)}
      className="unit-switch inline-flex h-11 min-w-11 items-center justify-center px-1 text-[15px] font-medium text-ink"
    >
      {unit}
    </button>
  );
}

/** The persistent global in/cm switch for tape readings and height. */
export function LengthUnitToggle() {
  const [lengthUnit, setLengthUnit] = useLengthUnit();
  return (
    <div role="group" aria-label="Tape unit" className={chipTrackClass}>
      {LENGTH_UNITS.map((u) => (
        <button
          key={u}
          type="button"
          aria-pressed={lengthUnit === u}
          onClick={() => setLengthUnit(u)}
          className={`${chipClass(lengthUnit === u)} ${sizeClass}`}
        >
          {u}
        </button>
      ))}
    </div>
  );
}
