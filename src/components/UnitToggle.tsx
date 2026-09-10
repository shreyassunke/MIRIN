import { useLengthUnit, useUnit } from "../lib/settings";
import type { LengthUnit, Unit } from "../lib/units";
import { chipClass, chipTrackClass } from "./chip";

const UNITS: Unit[] = ["lb", "kg"];
const LENGTH_UNITS: LengthUnit[] = ["in", "cm"];

const sizeClass = "h-9 min-w-10 px-3 text-[13px]";

/** The persistent global lb/kg switch. */
export function UnitToggle() {
  const [unit, setUnit] = useUnit();
  return (
    <div role="group" aria-label="Weight unit" className={chipTrackClass}>
      {UNITS.map((u) => (
        <button
          key={u}
          type="button"
          aria-pressed={unit === u}
          onClick={() => setUnit(u)}
          className={`${chipClass(unit === u)} ${sizeClass}`}
        >
          {u}
        </button>
      ))}
    </div>
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
