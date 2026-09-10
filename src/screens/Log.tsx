import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { DualTrendChart, type DualTrendPoint } from "../components/TrendChart";
import { Stepper } from "../components/Stepper";
import { db, type MeasurementEntry, type NutritionLog } from "../db/db";
import {
  BODY_WEIGHT_FIELD_ID,
  ensureCoreFields,
  saveMeasurement,
} from "../lib/body";
import { formatDayHeading } from "../lib/history";
import {
  CALORIE_STEP,
  DEFAULT_CALORIES,
  DEFAULT_PROTEIN_G,
  PROTEIN_STEP,
  saveMacroDay,
  todayMacroKey,
} from "../lib/macros";
import { useUnit } from "../lib/settings";
import {
  BODY_WEIGHT_STEP,
  formatMeasure,
  toCanonical,
  toDisplay,
  type Unit,
} from "../lib/units";

const DEFAULT_WEIGHT_LBS = 175;

function shortDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function buildTrend(
  weights: MeasurementEntry[],
  macros: NutritionLog[],
  unit: Unit,
): DualTrendPoint[] {
  const byDate = new Map<string, DualTrendPoint & { dateKey: string }>();
  for (const entry of weights) {
    byDate.set(entry.dateKey, {
      dateKey: entry.dateKey,
      date: shortDate(entry.dateKey),
      weight: toDisplay(entry.value, unit),
    });
  }
  for (const log of macros) {
    const existing = byDate.get(log.id) ?? {
      dateKey: log.id,
      date: shortDate(log.id),
    };
    existing.calories = log.calories;
    byDate.set(log.id, existing);
  }
  return [...byDate.values()]
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    .map(({ date, weight, calories }) => ({ date, weight, calories }));
}

interface DayRow {
  dateKey: string;
  weightLbs: number | null;
  proteinG: number | null;
  calories: number | null;
}

function mergeRecent(
  weights: MeasurementEntry[],
  macros: NutritionLog[],
  todayKey: string,
  limit = 21,
): DayRow[] {
  const byDate = new Map<string, DayRow>();
  for (const entry of weights) {
    byDate.set(entry.dateKey, {
      dateKey: entry.dateKey,
      weightLbs: entry.value,
      proteinG: null,
      calories: null,
    });
  }
  for (const log of macros) {
    const existing = byDate.get(log.id) ?? {
      dateKey: log.id,
      weightLbs: null,
      proteinG: null,
      calories: null,
    };
    existing.proteinG = log.proteinG;
    existing.calories = log.calories;
    byDate.set(log.id, existing);
  }
  return [...byDate.values()]
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
    .filter((row) => row.dateKey <= todayKey)
    .slice(0, limit);
}

export function Log() {
  const todayKey = todayMacroKey();
  const [unit] = useUnit();

  useEffect(() => {
    void ensureCoreFields();
  }, []);

  const data = useLiveQuery(async () => {
    const [allMacros, weightEntries] = await Promise.all([
      db.nutritionLogs.toArray(),
      db.measurementEntries
        .where("fieldId")
        .equals(BODY_WEIGHT_FIELD_ID)
        .toArray(),
    ]);
    const todayMacros = allMacros.find((log) => log.id === todayKey) ?? null;
    const previousMacros = allMacros
      .filter((log) => log.id < todayKey)
      .sort((a, b) => b.id.localeCompare(a.id))[0];
    const todayWeight =
      weightEntries.find((e) => e.dateKey === todayKey) ?? null;
    const previousWeight = weightEntries
      .filter((e) => e.dateKey < todayKey)
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey))[0];
    return {
      todayMacros,
      todayWeight,
      previousMacros,
      previousWeight,
      allMacros,
      weightEntries,
    };
  }, [todayKey]);

  const [weightLbs, setWeightLbs] = useState(DEFAULT_WEIGHT_LBS);
  const [protein, setProtein] = useState(DEFAULT_PROTEIN_G);
  const [calories, setCalories] = useState(DEFAULT_CALORIES);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(false);
  }, [todayKey]);

  useEffect(() => {
    if (!data || hydrated) return;
    const sourceWeight = data.todayWeight ?? data.previousWeight;
    setWeightLbs(sourceWeight?.value ?? DEFAULT_WEIGHT_LBS);
    const sourceMacros = data.todayMacros ?? data.previousMacros;
    if (sourceMacros) {
      setProtein(sourceMacros.proteinG);
      setCalories(sourceMacros.calories);
    }
    setHydrated(true);
  }, [data, hydrated]);

  const loggedToday = Boolean(data?.todayMacros || data?.todayWeight);
  const trend = data
    ? buildTrend(data.weightEntries, data.allMacros, unit)
    : [];
  const recent = data
    ? mergeRecent(data.weightEntries, data.allMacros, todayKey)
    : [];

  const save = () => {
    void saveMeasurement(BODY_WEIGHT_FIELD_ID, weightLbs, todayKey);
    void saveMacroDay(todayKey, protein, calories);
  };

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Log</h1>
        <p className="mt-1 max-w-[65ch] text-sm leading-relaxed text-muted">
          Body weight and macros for the day. Last log is the default.
        </p>
      </header>

      <section className="mb-10" aria-labelledby="log-trend">
        <h2
          id="log-trend"
          className="mb-3 text-[13px] font-medium text-muted"
        >
          Trend
        </h2>
        <DualTrendChart data={trend} weightLabel={unit} />
      </section>

      <section className="mb-10" aria-labelledby="today-log">
        <h2
          id="today-log"
          className="mb-4 text-[13px] font-medium text-muted"
        >
          {formatDayHeading(todayKey)}
        </h2>

        <div className="space-y-6 rounded-xl glass p-4 shadow-glass sm:p-5">
          <div className="flex flex-wrap justify-center gap-8">
            <Stepper
              label={`Weight (${unit})`}
              value={toDisplay(weightLbs, unit)}
              step={BODY_WEIGHT_STEP[unit]}
              min={0}
              format={formatMeasure}
              onChange={(next) => setWeightLbs(toCanonical(next, unit))}
            />
            <Stepper
              label="Protein (g)"
              value={protein}
              step={PROTEIN_STEP}
              min={0}
              onChange={setProtein}
            />
            <Stepper
              label="Calories"
              value={calories}
              step={CALORIE_STEP}
              min={0}
              onChange={setCalories}
            />
          </div>
          <button
            type="button"
            className="btn-primary h-12 w-full rounded-pill bg-accent text-[15px] font-semibold text-bg hover:bg-ink"
            onClick={save}
            disabled={!hydrated}
          >
            {loggedToday ? "Update" : "Log day"}
          </button>
        </div>
      </section>

      <section aria-labelledby="recent-log">
        <h2
          id="recent-log"
          className="mb-2 text-[13px] font-medium text-muted"
        >
          Recent
        </h2>
        {data === undefined ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="max-w-[65ch] text-sm leading-relaxed text-muted">
            No days logged yet. Numbers above are a starting point — adjust,
            then log.
          </p>
        ) : (
          <ul className="divide-y divide-hairline rounded-md border border-hairline bg-surface">
            {recent.map((row) => (
              <LogRow
                key={row.dateKey}
                row={row}
                unit={unit}
                isToday={row.dateKey === todayKey}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function LogRow({
  row,
  unit,
  isToday,
}: {
  row: DayRow;
  unit: Unit;
  isToday?: boolean;
}) {
  const parts: string[] = [];
  if (row.weightLbs != null) {
    parts.push(`${formatMeasure(toDisplay(row.weightLbs, unit))} ${unit}`);
  }
  if (row.proteinG != null && row.calories != null) {
    parts.push(`${row.proteinG} g protein · ${row.calories} kcal`);
  } else if (row.proteinG != null) {
    parts.push(`${row.proteinG} g protein`);
  } else if (row.calories != null) {
    parts.push(`${row.calories} kcal`);
  }

  return (
    <li className="flex items-baseline justify-between gap-4 px-4 py-3">
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold tracking-tight text-ink">
          {isToday ? "Today" : formatDayHeading(row.dateKey)}
        </span>
        <span className="tnum mt-0.5 block text-[13px] text-muted">
          {parts.join(" · ")}
        </span>
      </span>
    </li>
  );
}
