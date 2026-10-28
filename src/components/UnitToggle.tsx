import { useLengthUnit, useUnit } from "../lib/settings";

/** One weight unit at a time. A tap swaps pounds and kilograms. */
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

/** One tape unit at a time. A tap swaps inches and centimetres. */
export function LengthToggle() {
  const [lengthUnit, setLengthUnit] = useLengthUnit();
  const next = lengthUnit === "in" ? "cm" : "in";
  return (
    <button
      type="button"
      aria-label={
        lengthUnit === "in"
          ? "Inches. Switch to centimeters."
          : "Centimeters. Switch to inches."
      }
      onClick={() => setLengthUnit(next)}
      className="unit-switch inline-flex h-11 min-w-11 items-center justify-center px-1 text-[15px] font-medium text-ink"
    >
      {lengthUnit}
    </button>
  );
}

/** Weight unit and tape unit, the only unit control on Log. */
export function MeasureUnits() {
  return (
    <>
      <UnitToggle />
      <LengthToggle />
    </>
  );
}
