import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ConfirmDelete } from "../components/ConfirmDelete";
import { ProfileNav } from "../components/ProfileNav";
import { Stepper } from "../components/Stepper";
import { TrendChart, type TrendPoint } from "../components/TrendChart";
import { UnitToggle } from "../components/UnitToggle";
import { db, type MeasurementKind } from "../db/db";
import {
  DEFAULT_HEIGHT_CM,
  addCustomField,
  buildSeries,
  ensureCoreFields,
  fallbackFor,
  removeField,
  saveMeasurement,
  setFieldTarget,
  useGender,
  useHeightCm,
  type FieldSeries,
  type Gender,
} from "../lib/body";
import { deriveMetrics, fieldProgress } from "../lib/bodyMetrics";
import { useLengthUnit, useUnit } from "../lib/settings";
import {
  BODY_WEIGHT_STEP,
  HEIGHT_STEP,
  LENGTH_STEP,
  formatHeight,
  formatMeasure,
  toCanonical,
  toDisplay,
  toLengthCanonical,
  toLengthDisplay,
  type LengthUnit,
  type Unit,
} from "../lib/units";

const WEIGHT_FIELD_ID = "body-weight";

const GENDERS: { value: Gender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

const KINDS: { value: MeasurementKind; label: string }[] = [
  { value: "length", label: "Tape" },
  { value: "mass", label: "Weight" },
];

const secondaryBtn =
  "glass-btn h-11 rounded-pill px-4 text-sm font-medium text-ink";
const quietBtn =
  "text-[13px] font-medium text-muted transition-colors duration-150 hover:text-ink";
const chipClass = (active: boolean) =>
  [
    "glass-chip rounded-pill text-sm font-medium",
    active ? "glass-chip-active text-ink" : "text-muted hover:text-ink",
  ].join(" ");

/** Short label from a YYYY-MM-DD key. */
function shortDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

interface UnitContext {
  unit: Unit;
  lengthUnit: LengthUnit;
}

const suffixFor = (kind: MeasurementKind, ctx: UnitContext) =>
  kind === "mass" ? ctx.unit : ctx.lengthUnit;

const displayOf = (canonical: number, kind: MeasurementKind, ctx: UnitContext) =>
  kind === "mass"
    ? toDisplay(canonical, ctx.unit)
    : toLengthDisplay(canonical, ctx.lengthUnit);

const canonicalOf = (display: number, kind: MeasurementKind, ctx: UnitContext) =>
  kind === "mass"
    ? toCanonical(display, ctx.unit)
    : toLengthCanonical(display, ctx.lengthUnit);

const stepFor = (kind: MeasurementKind, ctx: UnitContext) =>
  kind === "mass" ? BODY_WEIGHT_STEP[ctx.unit] : LENGTH_STEP[ctx.lengthUnit];

const withUnit = (canonical: number, kind: MeasurementKind, ctx: UnitContext) =>
  `${formatMeasure(displayOf(canonical, kind, ctx))} ${suffixFor(kind, ctx)}`;

/** "neck, waist and hips" — reads as a sentence, not a debug array. */
function formatList(items: string[]): string {
  if (items.length === 0) return "readings";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const DEFAULT_WEIGHT_LBS = 175;

/** Current body weight — writes today's reading the moment it changes. */
function BodyWeightControl({
  latestLbs,
  unit,
}: {
  latestLbs: number | null;
  unit: Unit;
}) {
  const [value, setValue] = useState(() =>
    toDisplay(latestLbs ?? DEFAULT_WEIGHT_LBS, unit),
  );

  const commit = (next: number) => {
    setValue(next);
    void saveMeasurement(WEIGHT_FIELD_ID, toCanonical(next, unit));
  };

  return (
    <div className="flex flex-col items-center">
      <Stepper
        label={`Weight (${unit})`}
        value={value}
        step={BODY_WEIGHT_STEP[unit]}
        min={0}
        format={formatMeasure}
        onChange={commit}
      />
      {latestLbs == null ? (
        <p className="mt-2 text-[13px] text-muted">
          Not logged yet — adjust to save it.
        </p>
      ) : null}
    </div>
  );
}

export function Measurements() {
  const [unit] = useUnit();
  const [lengthUnit, setLengthUnit] = useLengthUnit();
  const [gender, setGender] = useGender();
  const [heightCm, setHeightCm] = useHeightCm();
  const ctx = useMemo<UnitContext>(
    () => ({ unit, lengthUnit }),
    [unit, lengthUnit],
  );

  useEffect(() => {
    void ensureCoreFields();
  }, []);

  const data = useLiveQuery(async () => {
    const [fields, entries] = await Promise.all([
      db.measurementFields.toArray(),
      db.measurementEntries.toArray(),
    ]);
    return buildSeries(fields, entries);
  }, []);

  // Only one accent action is ever on screen: opening one closes the other.
  const [openField, setOpenField] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [chartField, setChartField] = useState<string | null>(null);

  const series = data ?? [];
  const latestOf = (fieldId: string) =>
    series.find((s) => s.field.id === fieldId)?.latest?.value ?? null;

  const weightLbs = latestOf(WEIGHT_FIELD_ID);
  const metrics = deriveMetrics({
    gender,
    heightCm,
    weightLbs,
    waistCm: latestOf("waist"),
    neckCm: latestOf("neck"),
    hipsCm: latestOf("hips"),
  });

  // Composition metrics hang off the body fat estimate, so point at the row
  // above rather than repeating its whole list of unmet inputs.
  const compositionNote =
    weightLbs == null
      ? "Needs body weight"
      : "Follows from the body fat estimate";

  const heightDisplay = Math.round(
    lengthUnit === "cm"
      ? (heightCm ?? DEFAULT_HEIGHT_CM)
      : toLengthDisplay(heightCm ?? DEFAULT_HEIGHT_CM, "in"),
  );

  const tapeSeries = series.filter((s) => s.field.id !== WEIGHT_FIELD_ID);
  const chartable = series.filter((s) => s.entries.length >= 2);
  const activeChart =
    chartable.find((s) => s.field.id === chartField) ?? chartable[0] ?? null;

  return (
    <div>
      <ProfileNav />

      <section className="mb-10" aria-labelledby="body-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="body-heading" className="text-lg font-semibold tracking-tight">
            Body
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <UnitToggle />
            <div
              role="group"
              aria-label="Tape unit"
              className="glass flex overflow-hidden rounded-pill p-0.5"
            >
              {(["in", "cm"] as LengthUnit[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  aria-pressed={lengthUnit === u}
                  onClick={() => setLengthUnit(u)}
                  className={`${chipClass(lengthUnit === u)} h-9 min-w-10 px-3 text-[13px]`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6 rounded-xl glass p-4 shadow-glass sm:p-5">
          <div>
            <span
              id="gender-label"
              className="mb-2 block text-[13px] font-medium text-muted"
            >
              Gender
            </span>
            <div
              role="group"
              aria-labelledby="gender-label"
              className="glass flex w-fit overflow-hidden rounded-pill p-0.5"
            >
              {GENDERS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  aria-pressed={gender === g.value}
                  onClick={() => setGender(g.value)}
                  className={`${chipClass(gender === g.value)} h-11 px-5`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-8">
            <BodyWeightControl
              key={unit}
              latestLbs={weightLbs}
              unit={unit}
            />
            <div className="flex flex-col items-center">
              <Stepper
                label="Height"
                value={heightDisplay}
                step={HEIGHT_STEP[lengthUnit]}
                min={lengthUnit === "cm" ? 120 : 48}
                max={lengthUnit === "cm" ? 230 : 90}
                format={(v) =>
                  formatHeight(
                    lengthUnit === "cm" ? v : toLengthCanonical(v, "in"),
                    lengthUnit,
                  )
                }
                onChange={(v) =>
                  setHeightCm(
                    lengthUnit === "cm" ? v : toLengthCanonical(v, "in"),
                  )
                }
              />
              {heightCm === null ? (
                <p className="mt-2 text-[13px] text-muted">
                  Not set yet — adjust to save it.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="mb-10" aria-labelledby="derived-heading">
        <h2
          id="derived-heading"
          className="mb-1 text-lg font-semibold tracking-tight"
        >
          Derived
        </h2>
        <p className="mb-4 max-w-[65ch] text-sm leading-relaxed text-muted">
          Calculated from gender, height, weight, and the tape readings. BMI
          reads high on muscular builds — FFMI is the lean-mass equivalent.
        </p>
        <dl className="divide-y divide-hairline rounded-md border border-hairline bg-surface">
          <MetricRow
            term="BMI"
            value={metrics.bmi != null ? formatMeasure(metrics.bmi) : null}
            note={metrics.bmiBand ?? undefined}
            missingNote={`Needs ${formatList(metrics.bmiNeeds)}`}
          />
          <MetricRow
            term="Body fat"
            value={
              metrics.bodyFatPct != null
                ? `${formatMeasure(metrics.bodyFatPct)}%`
                : null
            }
            note="US Navy tape method"
            missingNote={`Needs ${formatList(metrics.bodyFatNeeds)}`}
          />
          <MetricRow
            term="Lean mass"
            value={
              metrics.leanLbs != null
                ? withUnit(metrics.leanLbs, "mass", ctx)
                : null
            }
            missingNote={compositionNote}
          />
          <MetricRow
            term="Fat mass"
            value={
              metrics.fatLbs != null ? withUnit(metrics.fatLbs, "mass", ctx) : null
            }
            missingNote={compositionNote}
          />
          <MetricRow
            term="FFMI"
            value={metrics.ffmi != null ? formatMeasure(metrics.ffmi) : null}
            note="Lean mass for your height"
            missingNote={
              heightCm == null ? "Needs height" : "Follows from lean mass"
            }
          />
        </dl>
      </section>

      <section className="mb-10" aria-labelledby="readings-heading">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2
            id="readings-heading"
            className="text-lg font-semibold tracking-tight"
          >
            Measurements
          </h2>
          {!adding ? (
            <button
              type="button"
              className={quietBtn}
              onClick={() => {
                setAdding(true);
                setOpenField(null);
              }}
            >
              Add field
            </button>
          ) : null}
        </div>
        <p className="mb-4 max-w-[65ch] text-sm leading-relaxed text-muted">
          Tap a row to log today’s reading. One reading per field per day —
          logging again the same day corrects it.
        </p>

        {adding ? (
          <div className="mb-4">
            <AddFieldForm
              onDone={() => setAdding(false)}
              existingLabels={[
                "body weight",
                ...tapeSeries.map((s) => s.field.label.toLowerCase()),
              ]}
            />
          </div>
        ) : null}

        {data === undefined ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          <ul className="divide-y divide-hairline rounded-md border border-hairline bg-surface">
            {tapeSeries.map((entry) => (
              <FieldRow
                key={entry.field.id}
                series={entry}
                ctx={ctx}
                open={openField === entry.field.id}
                onOpen={() => {
                  setOpenField(entry.field.id);
                  setAdding(false);
                }}
                onClose={() => setOpenField(null)}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="trend-heading">
        <h2
          id="trend-heading"
          className="mb-3 text-lg font-semibold tracking-tight"
        >
          Trend
        </h2>
        {chartable.length === 0 ? (
          <p className="max-w-[65ch] text-sm leading-relaxed text-muted">
            Log a field on two separate days to see its trend.
          </p>
        ) : (
          <>
            {chartable.length > 1 ? (
              <div className="mb-3 flex flex-wrap gap-2">
                {chartable.map((s) => {
                  const isActive = activeChart?.field.id === s.field.id;
                  return (
                    <button
                      key={s.field.id}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setChartField(s.field.id)}
                      className={`${chipClass(isActive)} h-9 px-3 text-[13px]`}
                    >
                      {s.field.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
            {activeChart ? (
              <TrendChart
                data={activeChart.entries.map<TrendPoint>((e) => ({
                  date: shortDate(e.dateKey),
                  value: displayOf(e.value, activeChart.field.kind, ctx),
                }))}
                height={200}
                valueLabel={suffixFor(activeChart.field.kind, ctx)}
              />
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

function MetricRow({
  term,
  value,
  note,
  missingNote,
}: {
  term: string;
  value: string | null;
  note?: string;
  /** Shown in place of the note when the metric cannot be computed. */
  missingNote: string;
}) {
  const missing = value === null;
  // The unmet-input list belongs under the label, where the note already
  // lives: right-aligning a sentence against a number column cramps both.
  const subnote = missing ? missingNote : note;
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3">
      <dt className="min-w-0">
        <span className="block text-[15px] font-semibold tracking-tight text-ink">
          {term}
        </span>
        {subnote ? (
          <span className="mt-0.5 block text-[13px] leading-snug text-muted">
            {subnote}
          </span>
        ) : null}
      </dt>
      <dd
        className={
          missing
            ? "shrink-0 text-xl font-semibold text-muted"
            : "tnum shrink-0 text-right text-xl font-semibold tracking-tight text-ink"
        }
      >
        {missing ? "—" : value}
      </dd>
    </div>
  );
}

function FieldRow({
  series,
  ctx,
  open,
  onOpen,
  onClose,
}: {
  series: FieldSeries;
  ctx: UnitContext;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const { field, first, latest } = series;
  const kind = field.kind;
  const suffix = suffixFor(kind, ctx);

  const progress =
    field.target != null && first && latest
      ? fieldProgress(first.value, latest.value, field.target)
      : null;

  return (
    <li>
      <button
        type="button"
        onClick={() => (open ? onClose() : onOpen())}
        aria-expanded={open}
        className="flex min-h-[56px] w-full items-baseline justify-between gap-4 px-4 py-3 text-left transition-colors duration-150 hover:bg-surface-raised"
      >
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold tracking-tight text-ink">
            {field.label}
          </span>
          <span className="mt-0.5 block text-[13px] text-muted">
            {latest
              ? `${shortDate(latest.dateKey)}${
                  field.target != null
                    ? ` · target ${withUnit(field.target, kind, ctx)}`
                    : ""
                }`
              : "No reading yet"}
          </span>
        </span>
        <span className="shrink-0 text-right">
          {latest ? (
            <span className="tnum block text-xl font-semibold tracking-tight text-ink">
              {formatMeasure(displayOf(latest.value, kind, ctx))}
              <span className="ml-1 text-[13px] font-medium text-muted">
                {suffix}
              </span>
            </span>
          ) : (
            <span className="text-[13px] text-muted">Log</span>
          )}
        </span>
      </button>

      {progress ? (
        <div className="px-4 pb-3">
          <div
            aria-hidden="true"
            className="h-0.5 w-full overflow-hidden rounded-pill bg-hairline"
          >
            <div
              className="h-full bg-muted"
              style={{ width: `${Math.round(progress.fraction * 100)}%` }}
            />
          </div>
          <p className="tnum mt-1.5 text-[13px] text-muted">
            {progress.reached
              ? `Target reached · from ${withUnit(progress.start, kind, ctx)}`
              : `${formatMeasure(
                  Math.abs(displayOf(progress.remaining, kind, ctx)),
                )} ${suffix} to go · ${Math.round(progress.fraction * 100)}% from ${withUnit(
                  progress.start,
                  kind,
                  ctx,
                )}`}
          </p>
        </div>
      ) : null}

      {open ? (
        <FieldEditor
          // Remounting on unit change re-seeds the steppers in the new unit.
          key={`${field.id}-${suffix}`}
          series={series}
          ctx={ctx}
          onClose={onClose}
        />
      ) : null}
    </li>
  );
}

function FieldEditor({
  series,
  ctx,
  onClose,
}: {
  series: FieldSeries;
  ctx: UnitContext;
  onClose: () => void;
}) {
  const { field, latest } = series;
  const kind = field.kind;
  const suffix = suffixFor(kind, ctx);
  const step = stepFor(kind, ctx);

  const [value, setValue] = useState(() =>
    displayOf(latest?.value ?? fallbackFor(field), kind, ctx),
  );
  const [target, setTarget] = useState(() =>
    field.target != null ? displayOf(field.target, kind, ctx) : 0,
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await saveMeasurement(field.id, canonicalOf(value, kind, ctx));
    await setFieldTarget(
      field.id,
      target > 0 ? canonicalOf(target, kind, ctx) : null,
    );
    onClose();
  };

  return (
    <div className="panel-in border-t border-hairline bg-bg px-4 py-4">
      <div className="flex flex-wrap justify-center gap-8">
        <Stepper
          label={`Today (${suffix})`}
          value={value}
          step={step}
          min={0}
          format={formatMeasure}
          onChange={setValue}
        />
        <Stepper
          label={`Target (${suffix})`}
          value={target}
          step={step}
          min={0}
          format={formatMeasure}
          onChange={setTarget}
        />
      </div>
      <p className="mt-3 text-center text-[13px] text-muted">
        A target of 0 clears it.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={saving}
          className="btn-primary h-11 flex-1 rounded-pill bg-accent px-4 text-sm font-semibold text-bg hover:bg-ink disabled:opacity-40"
          onClick={() => void save()}
        >
          {saving ? "Saving…" : "Save reading"}
        </button>
        <button type="button" className={secondaryBtn} onClick={onClose}>
          Cancel
        </button>
        {!field.isCore ? (
          <ConfirmDelete
            label="Remove field"
            onConfirm={() => {
              onClose();
              void removeField(field.id);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function AddFieldForm({
  onDone,
  existingLabels,
}: {
  onDone: () => void;
  existingLabels: string[];
}) {
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<MeasurementKind>("length");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = label.trim();
    if (!trimmed) {
      setError("Give the field a name.");
      return;
    }
    if (existingLabels.includes(trimmed.toLowerCase())) {
      setError("A field with that name already exists.");
      return;
    }
    await addCustomField(trimmed, kind);
    onDone();
  };

  return (
    <div className="rounded-xl glass p-4">
      <p className="mb-3 text-[13px] font-medium text-muted">New field</p>
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[13px] font-medium text-muted">
            Name
          </span>
          <input
            type="text"
            value={label}
            autoFocus
            onChange={(e) => {
              setLabel(e.target.value);
              setError(null);
            }}
            placeholder="Calf, forearm, shoulders…"
            className="h-11 w-full rounded-md border border-hairline bg-bg px-3 text-base text-ink placeholder:text-muted focus:border-muted"
          />
        </label>
        <div>
          <span
            id="kind-label"
            className="mb-1 block text-[13px] font-medium text-muted"
          >
            Measured with
          </span>
          <div
            role="group"
            aria-labelledby="kind-label"
            className="glass flex w-fit overflow-hidden rounded-pill p-0.5"
          >
            {KINDS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={kind === option.value}
                onClick={() => setKind(option.value)}
                className={`${chipClass(kind === option.value)} h-11 px-5`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {error ? (
        <p className="mt-3 text-[13px] text-ink" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          className="btn-primary h-11 flex-1 rounded-pill bg-accent px-4 text-sm font-semibold text-bg hover:bg-ink"
        >
          Save field
        </button>
        <button type="button" className={secondaryBtn} onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}
