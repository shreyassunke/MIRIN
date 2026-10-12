import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type MeasurementEntry, type NutritionLog } from "../db/db";
import {
  BODY_WEIGHT_FIELD_ID,
  DEFAULT_WEIGHT_LBS,
  saveMeasurement,
} from "../lib/body";
import { formatDayHeading, shortDate } from "../lib/history";
import {
  DEFAULT_CALORIES,
  DEFAULT_PROTEIN_G,
  saveMacroDay,
  todayMacroKey,
} from "../lib/macros";
import { useUnit } from "../lib/settings";
import { formatMeasure, toCanonical, toDisplay, type Unit } from "../lib/units";

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

function formatAmount(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : String(parseFloat(value.toFixed(1)));
}

function near(saved: number | null | undefined, current: number) {
  return saved != null && Math.abs(saved - current) < 0.001;
}

function parseDraft(text: string): number | null {
  const parsed = parseFloat(text.trim().replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Today's weight and macros, plus the ledger of what came before. */
export function LogDaily() {
  const todayKey = todayMacroKey();
  const [unit] = useUnit();
  const weightRef = useRef<HTMLInputElement>(null);
  const proteinRef = useRef<HTMLInputElement>(null);
  const caloriesRef = useRef<HTMLInputElement>(null);

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
  const [error, setError] = useState<string | null>(null);

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
  const dirty =
    !near(data?.todayWeight?.value, weightLbs) ||
    !near(data?.todayMacros?.proteinG, protein) ||
    !near(data?.todayMacros?.calories, calories);
  const canSave = hydrated && (!loggedToday || dirty);
  const recent = data
    ? mergeRecent(data.weightEntries, data.allMacros, todayKey)
    : [];

  const save = async () => {
    setError(null);
    try {
      await Promise.all([
        saveMeasurement(BODY_WEIGHT_FIELD_ID, weightLbs, todayKey),
        saveMacroDay(todayKey, protein, calories),
      ]);
    } catch {
      setError("Couldn't save. Try again.");
    }
  };

  const actionLabel = !loggedToday ? "Log day" : dirty ? "Update" : "Logged";

  return (
    <div>
      <section className="mb-12" aria-labelledby="today-log">
        <h2 id="today-log" className="mb-3 text-[13px] font-medium text-muted">
          {formatDayHeading(todayKey)}
        </h2>

        <div className="divide-y divide-hairline border-y border-hairline">
          <DayField
            key={unit}
            label="Weight"
            value={toDisplay(weightLbs, unit)}
            suffix={unit}
            fraction
            disabled={!hydrated}
            inputRef={weightRef}
            onChange={(next) => setWeightLbs(toCanonical(next, unit))}
            onEnter={() => proteinRef.current?.focus()}
          />
          <DayField
            label="Protein"
            value={protein}
            suffix="g"
            disabled={!hydrated}
            inputRef={proteinRef}
            onChange={setProtein}
            onEnter={() => caloriesRef.current?.focus()}
          />
          <DayField
            label="Calories"
            value={calories}
            suffix="kcal"
            disabled={!hydrated}
            inputRef={caloriesRef}
            onChange={setCalories}
          />
        </div>

        <button
          type="button"
          className={
            canSave
              ? "btn-primary mt-6 h-12 w-full rounded-pill text-[15px] font-semibold"
              : "mt-6 h-12 w-full rounded-pill text-[15px] font-semibold text-muted disabled:opacity-100"
          }
          onClick={() => void save()}
          disabled={!canSave}
        >
          {actionLabel}
        </button>
        {error ? (
          <p role="alert" className="mt-3 text-[13px] text-ink">
            {error}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="recent-log">
        <h2 id="recent-log" className="mb-3 text-[13px] font-medium text-muted">
          Recent
        </h2>
        {data === undefined ? (
          <p className="text-[15px] text-muted">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="text-[15px] text-muted">Nothing logged yet.</p>
        ) : (
          <Ledger rows={recent} unit={unit} todayKey={todayKey} />
        )}
      </section>
    </div>
  );
}

function DayField({
  label,
  value,
  suffix,
  fraction = false,
  disabled,
  inputRef,
  onChange,
  onEnter,
}: {
  label: string;
  value: number;
  suffix: string;
  fraction?: boolean;
  disabled?: boolean;
  inputRef: RefObject<HTMLInputElement>;
  onChange: (value: number) => void;
  onEnter?: () => void;
}) {
  const inputId = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const opened = useRef("");
  const cancel = useRef(false);

  const display = fraction ? formatMeasure(value) : formatAmount(value);
  const shown = editing ? draft : display;

  const commit = (text: string) => {
    setEditing(false);
    if (text.trim() === opened.current) return;
    const parsed = parseDraft(text);
    if (parsed === null) return;
    const next = fraction
      ? Math.round(Math.max(0, parsed) * 10) / 10
      : Math.max(0, Math.round(parsed));
    if (next !== value) onChange(next);
  };

  return (
    <label
      htmlFor={inputId}
      className={[
        "group flex min-h-14 items-center gap-4 transition-colors duration-150 ease-out-expo focus-within:bg-wash",
        disabled ? "cursor-default" : "cursor-text",
      ].join(" ")}
    >
      <span className="text-[15px] text-muted transition-colors duration-150 ease-out-expo group-focus-within:text-ink">
        {label}
      </span>
      <span className="ml-auto inline-flex items-baseline">
        <input
          ref={inputRef}
          id={inputId}
          data-field={label.toLowerCase()}
          type="text"
          inputMode={fraction ? "decimal" : "numeric"}
          enterKeyHint={onEnter ? "next" : "done"}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={disabled}
          aria-label={`${label} (${suffix})`}
          value={shown}
          onFocus={() => {
            opened.current = display;
            setDraft(display);
            setEditing(true);
            requestAnimationFrame(() => inputRef.current?.select());
          }}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => {
            if (cancel.current) {
              cancel.current = false;
              setEditing(false);
              return;
            }
            commit(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit(event.currentTarget.value);
              if (onEnter) onEnter();
              else event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              cancel.current = true;
              setDraft(opened.current);
              setEditing(false);
              event.currentTarget.blur();
            }
          }}
          className="numeral tnum min-w-[6ch] text-right text-xl font-semibold tracking-tight text-ink disabled:opacity-100"
        />
        <span className="w-11 shrink-0 pl-2 text-left text-[13px] font-medium text-muted">
          {suffix}
        </span>
      </span>
    </label>
  );
}

function Ledger({
  rows,
  unit,
  todayKey,
}: {
  rows: DayRow[];
  unit: Unit;
  todayKey: string;
}) {
  const num = (missing: boolean) =>
    [
      "tnum w-[4.5rem] py-3 pl-3 text-right text-[15px] tracking-tight",
      missing ? "font-medium text-muted" : "font-semibold text-ink",
    ].join(" ");
  const head = "w-[4.5rem] py-2 pl-3 text-right text-[13px] font-medium";

  return (
    <table className="w-full border-collapse border-y border-hairline">
      <caption className="sr-only">Recent days</caption>
      <thead>
        <tr className="border-b border-hairline text-muted">
          <th scope="col" className="py-2 pr-3 text-left font-medium">
            <span className="sr-only">Day</span>
          </th>
          <th scope="col" className={head}>
            {unit}
          </th>
          <th scope="col" className={head}>
            g
          </th>
          <th scope="col" className={head}>
            kcal
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.dateKey}
            className="border-b border-hairline last:border-0"
          >
            <th
              scope="row"
              className="py-3 pr-3 text-left text-[15px] font-medium text-ink"
            >
              {row.dateKey === todayKey ? "Today" : shortDate(row.dateKey)}
            </th>
            <td className={num(row.weightLbs == null)}>
              {row.weightLbs == null
                ? "—"
                : formatMeasure(toDisplay(row.weightLbs, unit))}
            </td>
            <td className={num(row.proteinG == null)}>
              {row.proteinG == null ? "—" : formatAmount(row.proteinG)}
            </td>
            <td className={num(row.calories == null)}>
              {row.calories == null ? "—" : formatAmount(row.calories)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
