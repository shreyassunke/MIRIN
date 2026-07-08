import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import type { Unit } from "./units";

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
