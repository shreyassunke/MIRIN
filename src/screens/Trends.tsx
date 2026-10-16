import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type SetLog, type WorkoutSession } from "../db/db";
import { formatDate, setVolume } from "../lib/workout";
import { toDisplay, type Unit } from "../lib/units";
import { useUnit } from "../lib/settings";
import { AxisScale, scaledWindow, scaleFromZoom } from "../components/AxisScale";
import { TrendChart, type TrendPoint } from "../components/TrendChart";
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

const CHART_H = 176;

export function Trends() {
  const [unit] = useUnit();
  const [picked, setPicked] = useState<RegionId | null>(null);
  const [xZoom, setXZoom] = useState(0);
  const [yZoom, setYZoom] = useState(0);
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
  const xDomain = useMemo(() => {
    if (points.length < 2) return undefined;
    const last = points.length - 1;
    return scaledWindow(0, last, scaleFromZoom(xZoom));
  }, [points, xZoom]);
  const yDomain = useMemo(() => {
    if (points.length < 2) return undefined;
    let lo = points[0].value;
    let hi = lo;
    for (const point of points) {
      lo = Math.min(lo, point.value);
      hi = Math.max(hi, point.value);
    }
    return scaledWindow(lo, hi, scaleFromZoom(yZoom));
  }, [points, yZoom]);

  if (!data || !volumes || !intensities) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  const selectRegion = (id: RegionId | null) => {
    setPicked(id);
    setXZoom(0);
    setYZoom(0);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-[12rem] min-w-0 flex-1">
        <Physique
          intensities={intensities}
          selected={picked}
          onSelect={selectRegion}
        />
      </div>

      <section data-physique-metric className="shrink-0 pt-6">
        <div className="flex items-baseline gap-3">
          <h2 className="text-lg font-semibold tracking-tight" aria-live="polite">
            {title}
          </h2>
          <p className="tnum shrink-0 text-[13px] text-muted">{unit}</p>
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
        ) : (
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            Per completed session
          </p>
        )}
        {hasTrend && xDomain && yDomain ? (
          <div className="mt-3 grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-3">
            <AxisScale
              axis="y"
              value={yZoom}
              onChange={setYZoom}
              label="Volume scale"
            />
            <TrendChart
              key={picked ?? "overall"}
              data={points}
              height={CHART_H}
              xDomain={xDomain}
              yDomain={yDomain}
              valueLabel={unit}
            />
            <div />
            <div className="pl-11">
              <AxisScale
                axis="x"
                value={xZoom}
                onChange={setXZoom}
                label="Time scale"
              />
            </div>
          </div>
        ) : (
          <p className="max-w-[65ch] pt-2 text-[13px] leading-relaxed text-muted">
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
      </section>
    </div>
  );
}
