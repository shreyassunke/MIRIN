import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Stepper } from "../components/Stepper";
import { db } from "../db/db";
import { formatDayHeading } from "../lib/history";
import {
  CALORIE_STEP,
  DEFAULT_CALORIES,
  DEFAULT_PROTEIN_G,
  PROTEIN_STEP,
  lastLogBefore,
  saveNutritionDay,
  todayNutritionKey,
} from "../lib/nutrition";

export function Nutrition() {
  const todayKey = todayNutritionKey();
  const data = useLiveQuery(async () => {
    const [existing, recent] = await Promise.all([
      db.nutritionLogs.get(todayKey),
      db.nutritionLogs.orderBy("id").reverse().limit(21).toArray(),
    ]);
    const previous = existing ? undefined : await lastLogBefore(todayKey);
    return { existing, previous, recent };
  }, [todayKey]);

  const [protein, setProtein] = useState(DEFAULT_PROTEIN_G);
  const [calories, setCalories] = useState(DEFAULT_CALORIES);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!data || hydrated) return;
    const source = data.existing ?? data.previous;
    if (source) {
      setProtein(source.proteinG);
      setCalories(source.calories);
    }
    setHydrated(true);
  }, [data, hydrated]);

  const loggedToday = Boolean(data?.existing);
  const recent = (data?.recent ?? []).filter((log) => log.id !== todayKey);

  const save = () => {
    void saveNutritionDay(todayKey, protein, calories);
  };

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Nutrition</h1>
        <p className="mt-1 text-sm text-muted">
          Protein and calories for the day. Last log is the default.
        </p>
      </header>

      <section className="mb-10" aria-labelledby="today-nutrition">
        <h2
          id="today-nutrition"
          className="mb-4 text-[13px] font-medium text-muted"
        >
          {formatDayHeading(todayKey)}
        </h2>

        <div className="space-y-6 rounded-xl glass p-4 shadow-glass sm:p-5">
          <div className="flex flex-wrap justify-center gap-8">
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
          >
            {loggedToday ? "Update" : "Log day"}
          </button>
        </div>
      </section>

      <section aria-labelledby="recent-nutrition">
        <h2
          id="recent-nutrition"
          className="mb-2 text-[13px] font-medium text-muted"
        >
          Recent
        </h2>
        {data === undefined ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : recent.length === 0 && !loggedToday ? (
          <p className="max-w-[65ch] text-sm leading-relaxed text-muted">
            No days logged yet. Numbers above are a starting point — adjust,
            then log.
          </p>
        ) : (
          <ul className="divide-y divide-hairline rounded-md border border-hairline bg-surface">
            {loggedToday && data.existing ? (
              <NutritionRow
                dateKey={data.existing.id}
                proteinG={data.existing.proteinG}
                calories={data.existing.calories}
                isToday
              />
            ) : null}
            {recent.map((log) => (
              <NutritionRow
                key={log.id}
                dateKey={log.id}
                proteinG={log.proteinG}
                calories={log.calories}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function NutritionRow({
  dateKey,
  proteinG,
  calories,
  isToday,
}: {
  dateKey: string;
  proteinG: number;
  calories: number;
  isToday?: boolean;
}) {
  return (
    <li className="flex items-baseline justify-between gap-4 px-4 py-3">
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold tracking-tight text-ink">
          {isToday ? "Today" : formatDayHeading(dateKey)}
        </span>
        <span className="tnum mt-0.5 block text-[13px] text-muted">
          {proteinG} g protein · {calories} kcal
        </span>
      </span>
    </li>
  );
}
