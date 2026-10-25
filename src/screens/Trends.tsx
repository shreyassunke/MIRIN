import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type SetLog, type WorkoutSession } from "../db/db";
import { formatDate, setVolume } from "../lib/workout";
import { toDisplay, type Unit } from "../lib/units";
import { useUnit } from "../lib/settings";
import { TrendChart, type TrendPoint } from "../components/TrendChart";
import {
  ChartReading,
  readChartReading,
  storeChartReading,
  type ChartReadingId,
} from "../components/ChartReading";
import { Physique } from "../components/physique/Physique";
import {
  REGION_LABEL,
  regionIntensities,
  volumeByRegion,
  type RegionId,
} from "../lib/muscleRegions";

function volumeTrend(
  sessions: WorkoutSession[],
  unit: Unit,
  bySession: Map<string, number>,
): TrendPoint[] {
  return sessions
    .filter((s) => s.completed && bySession.has(s.id))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s, i) => ({
      date: formatDate(s.date),
      value: toDisplay(bySession.get(s.id)!, unit),
      i,
    }));
}

function overallBySession(logs: SetLog[]): Map<string, number> {
  const bySession = new Map<string, number>();
  for (const log of logs) {
    bySession.set(
      log.sessionId,
      (bySession.get(log.sessionId) ?? 0) + setVolume(log),
    );
  }
  return bySession;
}

export function Trends() {
  const [unit] = useUnit();
  const [picked, setPicked] = useState<RegionId | null>(null);
  const [reading, setReading] = useState<ChartReadingId>(readChartReading);
  const data = useLiveQuery(async () => {
    const [sessions, logs, exercises] = await Promise.all([
      db.sessions.toArray(),
      db.setLogs.toArray(),
      db.exercises.toArray(),
    ]);
    return { sessions, logs, exercises };
  }, []);

  const volumes = useMemo(
    () =>
      data ? volumeByRegion(data.sessions, data.logs, data.exercises) : null,
    [data],
  );
  const intensities = useMemo(
    () => (volumes ? regionIntensities(volumes) : null),
    [volumes],
  );

  const ready = Boolean(data && volumes && intensities);
  const region = ready && picked && volumes ? volumes[picked] : null;
  const points = !data
    ? []
    : region
      ? volumeTrend(data.sessions, unit, region.bySession)
      : volumeTrend(data.sessions, unit, overallBySession(data.logs));
  const hasAny = (data?.logs.length ?? 0) > 0;
  const contributors = region ? region.contributors.slice(0, 4) : [];
  const title = picked ? REGION_LABEL[picked] : "Overall volume";
  const emptyLabel =
    points.length === 0 && picked
      ? `No ${title.toLowerCase()} volume yet`
      : "Not enough sessions yet — log two to see a trend";
  const hasTrend = points.length >= 2;
  const latest = points.length > 0 ? points[points.length - 1].value : null;

  const chooseReading = (next: ChartReadingId) => {
    setReading(next);
    storeChartReading(next);
  };

  if (!data || !volumes || !intensities) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  return (
    <div className="relative h-full min-h-0 [container-type:size]">
      <div className="absolute top-0 left-1/2 flex w-[min(100cqw,calc((100cqh-4.75rem)*3/2))] -translate-x-1/2 flex-col">
      <div
        data-physique-metric
        className="relative z-20 mb-3 flex shrink-0 items-start justify-between gap-3"
      >
        <div className="min-w-0">
          <div className="flex items-baseline gap-3">
            <h2
              className="truncate text-lg font-semibold tracking-tight"
              aria-live="polite"
            >
              {title}
            </h2>
            {latest != null ? (
              <p className="tnum shrink-0 text-[13px] text-muted">
                {Math.round(latest).toLocaleString()} {unit}
              </p>
            ) : null}
          </div>
          {contributors.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
              {contributors.map((lift) => (
                <Link
                  key={lift.id}
                  to={`/exercise/${lift.id}`}
                  className="text-[13px] font-medium text-muted transition-colors duration-150 hover:text-ink"
                >
                  {lift.name}
                </Link>
              ))}
            </div>
          ) : picked ? null : (
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              Per completed session
            </p>
          )}
        </div>
        <ChartReading value={reading} onChange={chooseReading} />
      </div>

      <div className="relative min-h-0">
        <div
          data-physique-metric
          data-physique-plate
          className="relative aspect-[3/2] w-full overflow-hidden rounded-md border border-hairline"
        >
          {hasTrend ? (
            <div className="pointer-events-none absolute inset-0">
              <TrendChart
                data={points}
                height="100%"
                variant={reading}
                interactive={false}
                yTicks={3}
                minTickGap={88}
                valueLabel={unit}
              />
            </div>
          ) : (
            <p className="absolute inset-x-4 bottom-3 z-20 max-w-[65ch] text-[13px] leading-relaxed text-muted">
              {!hasAny ? (
                <>
                  Nothing to chart yet. Progress appears after a completed
                  session on{" "}
                  <Link to="/today" className="font-medium text-ink">
                    Today
                  </Link>
                  .
                </>
              ) : (
                emptyLabel
              )}
            </p>
          )}
          <div
            className={
              hasTrend
                ? "absolute top-2 right-3 bottom-8 left-12 z-10"
                : "absolute inset-x-3 top-3 bottom-16 z-10"
            }
          >
            <Physique
              intensities={intensities}
              selected={picked}
              onSelect={setPicked}
            />
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
