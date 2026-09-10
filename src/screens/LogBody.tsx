import { useMemo, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ConfirmDelete } from "../components/ConfirmDelete";
import { Stepper } from "../components/Stepper";
import { chipClass, chipTrackClass } from "../components/chip";
import { db, type MeasurementKind } from "../db/db";
import {
  BODY_WEIGHT_FIELD_ID,
  DEFAULT_HEIGHT_CM,
  addCustomField,
  buildSeries,
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
import { shortDate } from "../lib/history";
import { useLengthUnit, useUnit } from "../lib/settings";
import {
  HEIGHT_STEP,
  LENGTH_STEP,
  BODY_WEIGHT_STEP,
  formatHeight,
  formatMeasure,
  toCanonical,
  toDisplay,
  toLengthCanonical,
  toLengthDisplay,
  type LengthUnit,
  type Unit,
} from "../lib/units";

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
const listClass =
  "divide-y divide-hairline rounded-md border border-hairline bg-surface";
const rowButtonClass =
  "flex min-h-[56px] w-full items-baseline justify-between gap-4 px-4 py-3 text-left transition-colors duration-150 hover:bg-surface-raised";
const sectionHeading = "text-lg font-semibold tracking-tight";

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

/**
 * The body profile: the two fixed inputs the estimates need, the tape
 * readings, and what falls out of them. Body weight is absent on purpose —
 * it is a daily number and lives on the Daily tab.
 */
export function LogBody() {
  const [unit] = useUnit();
  const [lengthUnit] = useLengthUnit();
  const [gender, setGender] = useGender();
  const [heightCm, setHeightCm] = useHeightCm();
  const ctx = useMemo<UnitContext>(
    () => ({ unit, lengthUnit }),
    [unit, lengthUnit],
  );

  const data = useLiveQuery(async () => {
    const [fields, entries] = await Promise.all([
      db.measurementFields.toArray(),
      db.measurementEntries.toArray(),
    ]);
    return buildSeries(fields, entries);
  }, []);

  // Exactly one editor is ever open: opening one closes the rest.
  const [open, setOpen] = useState<string | null>(null);
  const close = () => setOpen(null);
  const toggle = (key: string) => setOpen((prev) => (prev === key ? null : key));

  const series = data ?? [];
  const latestOf = (fieldId: string) =>
    series.find((s) => s.field.id === fieldId)?.latest?.value ?? null;

  const weightLbs = latestOf(BODY_WEIGHT_FIELD_ID);
  const metrics = deriveMetrics({
    gender,
    heightCm,
    weightLbs,
    waistCm: latestOf("waist"),
    neckCm: latestOf("neck"),
    hipsCm: latestOf("hips"),
  });

  const heightDisplay = Math.round(
    lengthUnit === "cm"
      ? (heightCm ?? DEFAULT_HEIGHT_CM)
      : toLengthDisplay(heightCm ?? DEFAULT_HEIGHT_CM, "in"),
  );

  const tapeSeries = series.filter(
    (s) => s.field.id !== BODY_WEIGHT_FIELD_ID,
  );

  return (
    <div>
      <section className="mb-10" aria-labelledby="basics-heading">
        <h2 id="basics-heading" className={`mb-3 ${sectionHeading}`}>
          Height and gender
        </h2>
        <ul className={listClass}>
          <SettingRow
            label="Height"
            value={
              heightCm == null ? null : formatHeight(heightCm, lengthUnit)
            }
            numeric
            open={open === "height"}
            onToggle={() => toggle("height")}
          >
            <div className="flex justify-center">
              <Stepper
                // Re-seed the stepper when the tape unit changes under it.
                key={lengthUnit}
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
            </div>
            <div className="mt-4 flex justify-center">
              <button type="button" className={secondaryBtn} onClick={close}>
                Done
              </button>
            </div>
          </SettingRow>

          <SettingRow
            label="Gender"
            value={gender == null ? null : gender === "male" ? "Male" : "Female"}
            open={open === "gender"}
            onToggle={() => toggle("gender")}
          >
            <div
              role="group"
              aria-label="Gender"
              className={`${chipTrackClass} mx-auto`}
            >
              {GENDERS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  aria-pressed={gender === g.value}
                  onClick={() => {
                    setGender(g.value);
                    close();
                  }}
                  className={`${chipClass(gender === g.value)} h-11 px-5 text-sm`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </SettingRow>
        </ul>
      </section>

      <section className="mb-10" aria-labelledby="readings-heading">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="readings-heading" className={sectionHeading}>
            Measurements
          </h2>
          {open !== "add" ? (
            <button
              type="button"
              className={quietBtn}
              onClick={() => setOpen("add")}
            >
              Add field
            </button>
          ) : null}
        </div>

        {open === "add" ? (
          <div className="mb-4">
            <AddFieldForm
              onDone={close}
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
          <ul className={listClass}>
            {tapeSeries.map((entry) => (
              <FieldRow
                key={entry.field.id}
                series={entry}
                ctx={ctx}
                open={open === `field:${entry.field.id}`}
                onOpen={() => setOpen(`field:${entry.field.id}`)}
                onClose={close}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="derived-heading">
        <h2 id="derived-heading" className={`mb-3 ${sectionHeading}`}>
          Derived
        </h2>
        <dl className={listClass}>
          <MetricRow
            term="BMI"
            value={metrics.bmi != null ? formatMeasure(metrics.bmi) : null}
            note={
              metrics.bmi != null
                ? (metrics.bmiBand ?? undefined)
                : `Needs ${formatList(metrics.bmiNeeds)}`
            }
          />
          <MetricRow
            term="Body fat"
            value={
              metrics.bodyFatPct != null
                ? `${formatMeasure(metrics.bodyFatPct)}%`
                : null
            }
            note={
              metrics.bodyFatPct != null
                ? undefined
                : `Needs ${formatList(metrics.bodyFatNeeds)}`
            }
          />
          {/* The three below hang off the body fat estimate, so they stay
              bare rather than repeating its unmet inputs three times. */}
          <MetricRow
            term="Lean mass"
            value={
              metrics.leanLbs != null
                ? withUnit(metrics.leanLbs, "mass", ctx)
                : null
            }
            note={weightLbs == null ? "Needs body weight" : undefined}
          />
          <MetricRow
            term="Fat mass"
            value={
              metrics.fatLbs != null
                ? withUnit(metrics.fatLbs, "mass", ctx)
                : null
            }
          />
          <MetricRow
            term="FFMI"
            value={metrics.ffmi != null ? formatMeasure(metrics.ffmi) : null}
          />
        </dl>
        <p className="mt-3 max-w-[65ch] text-[13px] leading-relaxed text-muted">
          Body fat uses the US Navy tape method. BMI reads high on muscular
          builds — FFMI is the lean-mass equivalent.
        </p>
      </section>
    </div>
  );
}

/** A set-once value: label, current reading, and an inline editor. */
function SettingRow({
  label,
  value,
  numeric = false,
  open,
  onToggle,
  children,
}: {
  label: string;
  /** Null renders the quiet "Set" affordance instead. */
  value: string | null;
  numeric?: boolean;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={rowButtonClass}
      >
        <span className="text-[15px] font-semibold tracking-tight text-ink">
          {label}
        </span>
        {value == null ? (
          <span className="shrink-0 text-[13px] text-muted">Set</span>
        ) : (
          <span
            className={
              numeric
                ? "tnum shrink-0 text-xl font-semibold tracking-tight text-ink"
                : "shrink-0 text-[15px] font-medium text-ink"
            }
          >
            {value}
          </span>
        )}
      </button>
      {open ? (
        <div className="panel-in border-t border-hairline bg-bg px-4 py-4">
          {children}
        </div>
      ) : null}
    </li>
  );
}

function MetricRow({
  term,
  value,
  note,
}: {
  term: string;
  value: string | null;
  /** Classifies the number, or names what is still missing. */
  note?: string;
}) {
  const missing = value === null;
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3">
      <dt className="min-w-0">
        <span className="block text-[15px] font-semibold tracking-tight text-ink">
          {term}
        </span>
        {note ? (
          <span className="mt-0.5 block text-[13px] leading-snug text-muted">
            {note}
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
        className={rowButtonClass}
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
            className={chipTrackClass}
          >
            {KINDS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={kind === option.value}
                onClick={() => setKind(option.value)}
                className={`${chipClass(kind === option.value)} h-11 px-5 text-sm`}
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
