import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { LogBody } from "./LogBody";
import { LogDaily } from "./LogDaily";

const EASE_OUT_EXPO = "cubic-bezier(0.16, 1, 0.3, 1)";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

const DailyPane = memo(LogDaily);
const BodyPane = memo(LogBody);

/**
 * The Log shell. The chart stays in this parent so switching Daily/Body
 * does not unmount it; logging sits above the trend.
 */
export function Log({ mode = "daily" }: { mode?: "daily" | "body" }) {
  const [warmBody, setWarmBody] = useState(mode === "body");
  const prevModeRef = useRef(mode);
  const dailyRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [unit] = useUnit();
  const [lengthUnit] = useLengthUnit();
  const [gender] = useGender();
  const [heightCm] = useHeightCm();

  useEffect(() => {
    void ensureCoreFields();
  }, []);

  useEffect(() => {
    if (mode === "body") setWarmBody(true);
  }, [mode]);

  useEffect(() => {
    if (warmBody) return;
    const t = window.setTimeout(() => setWarmBody(true), 120);
    return () => window.clearTimeout(t);
  }, [warmBody]);

  useLayoutEffect(() => {
    if (prevModeRef.current === mode) return;
    const from = prevModeRef.current;
    prevModeRef.current = mode;
    const target = mode === "body" ? bodyRef.current : dailyRef.current;
    if (!target || typeof target.animate !== "function") return;
    const dx = mode === "body" && from === "daily" ? 8 : -8;
    target.getAnimations().forEach((a) => a.cancel());
    if (prefersReducedMotion()) {
      target.animate([{ opacity: 0.72 }, { opacity: 1 }], {
        duration: 110,
        easing: EASE_OUT_EXPO,
      });
      return;
    }
    target.animate(
      [
        { opacity: 0, transform: `translate3d(${dx}px, 0, 0)` },
        { opacity: 1, transform: "translate3d(0, 0, 0)" },
      ],
      { duration: 160, easing: EASE_OUT_EXPO },
    );
  }, [mode]);

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
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <UnitToggle />
            <LengthUnitToggle />
          </div>
        </div>
      </header>

      <div className="mb-6">
        <SegmentedTabs
          ariaLabel="Log views"
          items={[
            { to: "/log", label: "Daily", end: true },
            { to: "/log/body", label: "Body" },
          ]}
        />
      </div>

      <div>
        <div
          ref={dailyRef}
          hidden={mode !== "daily"}
          aria-hidden={mode !== "daily" ? "true" : undefined}
        >
          <DailyPane />
        </div>
        {warmBody || mode === "body" ? (
          <div
            ref={bodyRef}
            hidden={mode !== "body"}
            aria-hidden={mode !== "body" ? "true" : undefined}
          >
            <BodyPane />
          </div>
        ) : null}
      </div>

      <div className="mt-8">
        <MetricTrend groups={groups} loading={data === undefined} />
      </div>
    </div>
  );
}
