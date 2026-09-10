import { Suspense, useEffect, useMemo } from "react";
import { Outlet } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { MetricTrend } from "../components/MetricTrend";
import { SegmentedTabs } from "../components/SegmentedTabs";
import { LengthUnitToggle, UnitToggle } from "../components/UnitToggle";
import { db } from "../db/db";
import {
  buildSeries,
  ensureCoreFields,
  useGender,
  useHeightCm,
} from "../lib/body";
import { buildMetricCatalog } from "../lib/metrics";
import { useLengthUnit, useUnit } from "../lib/settings";

/**
 * The Log shell. The trend sits above the tabs on purpose: switching between
 * writing numbers down and measuring should not take the chart away.
 */
export function Log() {
  const [unit] = useUnit();
  const [lengthUnit] = useLengthUnit();
  const [gender] = useGender();
  const [heightCm] = useHeightCm();

  useEffect(() => {
    void ensureCoreFields();
  }, []);

  const data = useLiveQuery(async () => {
    const [fields, entries, macros] = await Promise.all([
      db.measurementFields.toArray(),
      db.measurementEntries.toArray(),
      db.nutritionLogs.toArray(),
    ]);
    return { series: buildSeries(fields, entries), macros };
  }, []);

  const groups = useMemo(
    () =>
      buildMetricCatalog({
        series: data?.series ?? [],
        macros: data?.macros ?? [],
        gender,
        heightCm,
        unit,
        lengthUnit,
      }),
    [data, gender, heightCm, unit, lengthUnit],
  );

  return (
    <div>
      <header className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">Log</h1>
            <p className="mt-1 text-sm text-muted">
              Daily numbers and body measurements
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <UnitToggle />
            <LengthUnitToggle />
          </div>
        </div>
      </header>

      <div className="mb-8">
        <MetricTrend groups={groups} loading={data === undefined} />
      </div>

      <div className="mb-6">
        <SegmentedTabs
          ariaLabel="Log views"
          items={[
            { to: "/log", label: "Daily", end: true },
            { to: "/log/body", label: "Body" },
          ]}
        />
      </div>

      {/* Its own boundary: loading a tab must not take the chart away. */}
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <Outlet />
      </Suspense>
    </div>
  );
}
