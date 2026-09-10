import type { NutritionLog } from "../db/db";
import {
  BODY_WEIGHT_FIELD_ID,
  type FieldSeries,
  type Gender,
} from "./body";
import { deriveSeries, type DerivedSample } from "./bodyMetrics";
import {
  formatMeasure,
  toDisplay,
  toLengthDisplay,
  type LengthUnit,
  type Unit,
} from "./units";

export type MetricGroupId = "daily" | "measurements" | "derived";

export interface MetricPoint {
  dateKey: string;
  value: number;
}

export interface MetricSeries {
  id: string;
  label: string;
  group: MetricGroupId;
  /** Axis suffix in the active display unit. Empty for unitless indices. */
  unit: string;
  /** Oldest first, already converted to the display unit. */
  points: MetricPoint[];
  /** The value with its unit attached, ready to render. */
  format: (value: number) => string;
}

export interface MetricGroup {
  id: MetricGroupId;
  label: string;
  metrics: MetricSeries[];
}

export interface MetricCatalogInput {
  series: FieldSeries[];
  macros: NutritionLog[];
  gender: Gender | null;
  heightCm: number | null;
  unit: Unit;
  lengthUnit: LengthUnit;
}

const whole = (value: number) => Math.round(value).toLocaleString();

const suffixed = (unit: string) => (value: number) =>
  `${formatMeasure(value)} ${unit}`;

/** Signed change between two points, formatted in the metric's own unit. */
export function formatDelta(metric: MetricSeries, delta: number): string {
  const sign = delta > 0 ? "+" : delta < 0 ? "\u2212" : "";
  return `${sign}${metric.format(Math.abs(delta))}`;
}

function dailyMetrics(input: MetricCatalogInput): MetricSeries[] {
  const { unit } = input;
  const weight = input.series.find((s) => s.field.id === BODY_WEIGHT_FIELD_ID);
  const days = [...input.macros].sort((a, b) => a.id.localeCompare(b.id));

  return [
    {
      id: "daily.weight",
      label: "Body weight",
      group: "daily",
      unit,
      points: (weight?.entries ?? []).map((e) => ({
        dateKey: e.dateKey,
        value: toDisplay(e.value, unit),
      })),
      format: suffixed(unit),
    },
    {
      id: "daily.protein",
      label: "Protein",
      group: "daily",
      unit: "g",
      points: days.map((log) => ({ dateKey: log.id, value: log.proteinG })),
      format: (v) => `${whole(v)} g`,
    },
    {
      id: "daily.calories",
      label: "Calories",
      group: "daily",
      unit: "kcal",
      points: days.map((log) => ({ dateKey: log.id, value: log.calories })),
      format: (v) => `${whole(v)} kcal`,
    },
  ];
}

/** Every tracked field except body weight, which the daily group already owns. */
function measurementMetrics(input: MetricCatalogInput): MetricSeries[] {
  return input.series
    .filter((s) => s.field.id !== BODY_WEIGHT_FIELD_ID)
    .map((s) => {
      const isMass = s.field.kind === "mass";
      const suffix = isMass ? input.unit : input.lengthUnit;
      return {
        id: `field.${s.field.id}`,
        label: s.field.label,
        group: "measurements" as const,
        unit: suffix,
        points: s.entries.map((e) => ({
          dateKey: e.dateKey,
          value: isMass
            ? toDisplay(e.value, input.unit)
            : toLengthDisplay(e.value, input.lengthUnit),
        })),
        format: suffixed(suffix),
      };
    });
}

function derivedMetrics(input: MetricCatalogInput): MetricSeries[] {
  const { unit } = input;
  const readings = (fieldId: string) =>
    input.series.find((s) => s.field.id === fieldId)?.entries ?? [];

  const samples = deriveSeries({
    gender: input.gender,
    heightCm: input.heightCm,
    weightLbs: readings(BODY_WEIGHT_FIELD_ID),
    waistCm: readings("waist"),
    neckCm: readings("neck"),
    hipsCm: readings("hips"),
  });

  const specs: {
    id: string;
    label: string;
    unit: string;
    value: (sample: DerivedSample) => number | null;
    format: (value: number) => string;
  }[] = [
    {
      id: "bmi",
      label: "BMI",
      unit: "",
      value: (s) => s.bmi,
      format: formatMeasure,
    },
    {
      id: "body-fat",
      label: "Body fat",
      unit: "%",
      value: (s) => s.bodyFatPct,
      format: (v) => `${formatMeasure(v)}%`,
    },
    {
      id: "lean-mass",
      label: "Lean mass",
      unit,
      value: (s) => (s.leanLbs == null ? null : toDisplay(s.leanLbs, unit)),
      format: suffixed(unit),
    },
    {
      id: "fat-mass",
      label: "Fat mass",
      unit,
      value: (s) => (s.fatLbs == null ? null : toDisplay(s.fatLbs, unit)),
      format: suffixed(unit),
    },
    {
      id: "ffmi",
      label: "FFMI",
      unit: "",
      value: (s) => s.ffmi,
      format: formatMeasure,
    },
  ];

  return specs.map((spec) => ({
    id: `derived.${spec.id}`,
    label: spec.label,
    group: "derived",
    unit: spec.unit,
    points: samples.flatMap((sample) => {
      const value = spec.value(sample);
      return value == null ? [] : [{ dateKey: sample.dateKey, value }];
    }),
    format: spec.format,
  }));
}

/**
 * Every trackable metric, grouped for the trend switcher. Values arrive
 * already converted, so the chart never needs to know about units.
 * Metrics with nothing logged are dropped — an empty line is not a trend.
 */
export function buildMetricCatalog(input: MetricCatalogInput): MetricGroup[] {
  return [
    { id: "daily" as const, label: "Daily", metrics: dailyMetrics(input) },
    {
      id: "measurements" as const,
      label: "Measurements",
      metrics: measurementMetrics(input),
    },
    { id: "derived" as const, label: "Derived", metrics: derivedMetrics(input) },
  ].map((group) => ({
    ...group,
    metrics: group.metrics.filter((m) => m.points.length > 0),
  }));
}
