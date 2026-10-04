import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type SetLog, type WorkoutSession } from "../db/db";
import { formatDate, setVolume } from "../lib/workout";
import { toDisplay, type Unit } from "../lib/units";
import { useUnit } from "../lib/settings";
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
    .map((s) => ({
      date: formatDate(s.date),
      value: toDisplay(bySession.get(s.id)!, unit),
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

  if (!data || !volumes || !intensities) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  const overall = volumeTrend(
    data.sessions,
    unit,
    overallBySession(data.logs),
  );
  const region = picked ? volumes[picked] : null;
  const points = region
    ? volumeTrend(data.sessions, unit, region.bySession)
    : overall;
  const hasAny = data.logs.length > 0;
  const contributors = region ? region.contributors.slice(0, 4) : [];
  const title = picked ? REGION_LABEL[picked] : "Overall volume";
  const emptyLabel =
    points.length === 0 && picked
      ? `No ${title.toLowerCase()} volume yet`
      : "Not enough sessions yet — log two to see a trend";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-[14rem] min-w-0 flex-1">
        <Physique
          intensities={intensities}
          selected={picked}
          onSelect={setPicked}
        />
      </div>

      <section data-physique-metric className="shrink-0 pt-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight" aria-live="polite">
            {title}
          </h2>
          <p className="tnum text-[13px] text-muted">{unit}</p>
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
        <div className="mt-3">
          {points.length >= 2 ? (
            <TrendChart
              key={picked ?? "overall"}
              data={points}
              height={168}
              valueLabel={unit}
            />
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
        </div>
      </section>
    </div>
  );
}
