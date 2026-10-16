import { useLayoutEffect, useMemo, useRef, useState } from "react";
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

const CAPTION_GAP = 20;
const TICK_CLEARANCE = 16;
const AXIS_BAND = 36;

export function Trends() {
  const [unit] = useUnit();
  const [picked, setPicked] = useState<RegionId | null>(null);
  const captionRef = useRef<HTMLElement>(null);
  const [reserveTop, setReserveTop] = useState(72);
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
  const contributorKey = contributors.map((lift) => lift.id).join(" ");

  useLayoutEffect(() => {
    if (!ready) return;
    const el = captionRef.current;
    if (!el) return;
    const measure = () => {
      setReserveTop(Math.ceil(el.getBoundingClientRect().height) + CAPTION_GAP);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ready, title, contributorKey, hasTrend, emptyLabel, hasAny]);

  if (!data || !volumes || !intensities) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  return (
    <div className="relative h-full min-h-0">
      {hasTrend ? (
        <div className="pointer-events-none absolute inset-0 z-0">
          <TrendChart
            key={picked ?? "overall"}
            data={points}
            ground
            reserveTop={reserveTop + TICK_CLEARANCE}
            valueLabel={unit}
          />
        </div>
      ) : null}

      <div
        className="absolute inset-x-0 z-10"
        style={{ top: reserveTop, bottom: hasTrend ? AXIS_BAND : 0 }}
      >
        <Physique
          intensities={intensities}
          selected={picked}
          onSelect={setPicked}
        />
      </div>

      <section
        ref={captionRef}
        data-physique-metric
        className="pointer-events-none absolute inset-x-0 top-0 z-20"
      >
        <div className="flex items-baseline gap-3">
          <h2 className="text-lg font-semibold tracking-tight" aria-live="polite">
            {title}
          </h2>
          <p className="tnum shrink-0 text-[13px] text-muted">{unit}</p>
        </div>
        {contributors.length > 0 ? (
          <div className="pointer-events-auto mt-1 flex flex-wrap gap-x-3 gap-y-1">
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
        {!hasTrend ? (
          <p className="pointer-events-auto mt-3 max-w-[65ch] text-[13px] leading-relaxed text-muted">
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
        ) : null}
      </section>
    </div>
  );
}
