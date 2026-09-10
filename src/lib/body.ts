import { useLiveQuery } from "dexie-react-hooks";
import {
  db,
  type MeasurementEntry,
  type MeasurementField,
  type MeasurementKind,
} from "../db/db";
import { toLocalISODate } from "./rotation";
import { newId } from "./workout";

export type Gender = "male" | "female";

const GENDER_KEY = "body.gender";
const HEIGHT_KEY = "body.heightCm";

/** A sensible starting height so the stepper is never a blank field. */
export const DEFAULT_HEIGHT_CM = 178;

/** Starting body weight, in canonical pounds, before anything is logged. */
export const DEFAULT_WEIGHT_LBS = 175;

interface CoreFieldSpec {
  id: string;
  label: string;
  kind: MeasurementKind;
  /** Starting stepper value in canonical units (lbs for mass, cm for length). */
  fallback: number;
}

/**
 * Seeded fields. Neck, waist and hips are not optional decoration — the Navy
 * body-fat estimate is built from them.
 */
export const BODY_WEIGHT_FIELD_ID = "body-weight";

export const CORE_FIELDS: CoreFieldSpec[] = [
  {
    id: BODY_WEIGHT_FIELD_ID,
    label: "Body weight",
    kind: "mass",
    fallback: DEFAULT_WEIGHT_LBS,
  },
  { id: "waist", label: "Waist", kind: "length", fallback: 86.4 },
  { id: "neck", label: "Neck", kind: "length", fallback: 38.1 },
  { id: "hips", label: "Hips", kind: "length", fallback: 96.5 },
  { id: "chest", label: "Chest", kind: "length", fallback: 101.6 },
  { id: "arm", label: "Arm", kind: "length", fallback: 35.6 },
  { id: "wrist", label: "Wrist", kind: "length", fallback: 17.8 },
];

const CORE_BY_ID = new Map(CORE_FIELDS.map((f) => [f.id, f] as const));

/** Starting value for a field with no readings yet. */
export function fallbackFor(field: MeasurementField): number {
  const core = CORE_BY_ID.get(field.id);
  if (core) return core.fallback;
  return field.kind === "mass" ? DEFAULT_WEIGHT_LBS : 40;
}

export function todayKey(): string {
  return toLocalISODate(new Date());
}

let seeding: Promise<void> | null = null;

/**
 * Add any missing core fields without touching existing rows, so a synced
 * target is never clobbered on load. Single-flight and transactional: the
 * effect fires twice under StrictMode, and both calls would otherwise race
 * to insert the same primary keys.
 */
export function ensureCoreFields(): Promise<void> {
  seeding ??= db
    .transaction("rw", db.measurementFields, async () => {
      const existing = new Set(
        await db.measurementFields.toCollection().primaryKeys(),
      );
      const missing = CORE_FIELDS.filter((f) => !existing.has(f.id));
      if (missing.length === 0) return;
      const createdAt = new Date().toISOString();
      await db.measurementFields.bulkPut(
        missing.map((f) => ({
          id: f.id,
          label: f.label,
          kind: f.kind,
          // Indexed against the full list so a later-added core field slots
          // into place instead of colliding with an existing order.
          order: CORE_FIELDS.findIndex((c) => c.id === f.id) * 10,
          isCore: true,
          createdAt,
        })),
      );
    })
    .finally(() => {
      seeding = null;
    });
  return seeding;
}

/** One reading per field per day: same-day edits overwrite. */
export async function saveMeasurement(
  fieldId: string,
  value: number,
  dateKey: string = todayKey(),
): Promise<void> {
  const existing = await db.measurementEntries
    .where("[fieldId+dateKey]")
    .equals([fieldId, dateKey])
    .first();
  await db.measurementEntries.put({
    id: existing?.id ?? newId(),
    fieldId,
    dateKey,
    value,
    updatedAt: new Date().toISOString(),
  });
}

export async function setFieldTarget(
  fieldId: string,
  target: number | null,
): Promise<void> {
  const field = await db.measurementFields.get(fieldId);
  if (!field) return;
  const next = { ...field };
  if (target === null || target <= 0) delete next.target;
  else next.target = target;
  await db.measurementFields.put(next);
}

export async function addCustomField(
  label: string,
  kind: MeasurementKind,
): Promise<string> {
  const trimmed = label.trim();
  if (!trimmed) return "";
  const all = await db.measurementFields.toArray();
  const order = all.reduce((max, f) => Math.max(max, f.order), 0) + 10;
  const id = newId();
  await db.measurementFields.add({
    id,
    label: trimmed,
    kind,
    order,
    createdAt: new Date().toISOString(),
  });
  return id;
}

/** Removing a custom field takes its readings with it. */
export async function removeField(fieldId: string): Promise<void> {
  const field = await db.measurementFields.get(fieldId);
  if (!field || field.isCore) return;
  const entries = await db.measurementEntries
    .where("fieldId")
    .equals(fieldId)
    .toArray();
  await db.measurementEntries.bulkDelete(entries.map((e) => e.id));
  await db.measurementFields.delete(fieldId);
}

export function useGender(): [Gender | null, (gender: Gender) => void] {
  const value = useLiveQuery(
    async () => (await db.settings.get(GENDER_KEY))?.value ?? "",
    [],
  );
  const gender =
    value === "male" || value === "female" ? (value as Gender) : null;
  const setGender = (next: Gender) => {
    void db.settings.put({ key: GENDER_KEY, value: next });
  };
  return [gender, setGender];
}

export function useHeightCm(): [number | null, (cm: number) => void] {
  const value = useLiveQuery(
    async () => (await db.settings.get(HEIGHT_KEY))?.value ?? "",
    [],
  );
  const parsed = value ? Number(value) : NaN;
  const heightCm = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  const setHeightCm = (cm: number) => {
    void db.settings.put({ key: HEIGHT_KEY, value: String(cm) });
  };
  return [heightCm, setHeightCm];
}

export interface FieldSeries {
  field: MeasurementField;
  /** Oldest first. */
  entries: MeasurementEntry[];
  first: MeasurementEntry | null;
  latest: MeasurementEntry | null;
}

/** Group readings under their field, oldest first, fields in display order. */
export function buildSeries(
  fields: MeasurementField[],
  entries: MeasurementEntry[],
): FieldSeries[] {
  const byField = new Map<string, MeasurementEntry[]>();
  for (const entry of entries) {
    const list = byField.get(entry.fieldId) ?? [];
    list.push(entry);
    byField.set(entry.fieldId, list);
  }
  return [...fields]
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
    .map((field) => {
      const list = (byField.get(field.id) ?? []).sort((a, b) =>
        a.dateKey.localeCompare(b.dateKey),
      );
      return {
        field,
        entries: list,
        first: list[0] ?? null,
        latest: list[list.length - 1] ?? null,
      };
    });
}
