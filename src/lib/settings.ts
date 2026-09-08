import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import type { LengthUnit, Unit } from "./units";

/** Global weight unit, persisted in the local database. */
export function useUnit(): [Unit, (unit: Unit) => void] {
  const unit = (useLiveQuery(
    async () => (await db.settings.get("unit"))?.value,
    [],
  ) ?? "lb") as Unit;
  const setUnit = (next: Unit) => {
    void db.settings.put({ key: "unit", value: next });
  };
  return [unit, setUnit];
}

/**
 * Tape-measure unit. Kept separate from the weight unit on purpose: logging
 * pounds on the bar while measuring in centimetres is a normal combination.
 */
export function useLengthUnit(): [LengthUnit, (unit: LengthUnit) => void] {
  const unit = (useLiveQuery(
    async () => (await db.settings.get("unit.length"))?.value,
    [],
  ) ?? "in") as LengthUnit;
  const setUnit = (next: LengthUnit) => {
    void db.settings.put({ key: "unit.length", value: next });
  };
  return [unit, setUnit];
}
