import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type SetLog, type WorkoutSession } from "../db/db";
import { formatDate, setVolume } from "../lib/workout";
import { toDisplay, type Unit } from "../lib/units";
import { useGender } from "../lib/body";
import { useUnit } from "../lib/settings";
import { TrendChart, type TrendPoint } from "../components/TrendChart";
import { Physique } from "../components/physique/Physique";
import {
  busiestRegion,
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
  const [gender] = useGender();
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

  const selected = picked ?? busiestRegion(volumes);
  const region = volumes[selected];
  const regionTrend = volumeTrend(data.sessions, unit, region.bySession);
  const overall = volumeTrend(
    data.sessions,
    unit,
    overallBySession(data.logs),
  );
  const hasAny = data.logs.length > 0;
  const contributors = region.contributors.slice(0, 4);

  return (
    <div>
      <p className="mb-6 text-sm text-muted">
        Volume per completed session, in{" "}
        {unit === "lb" ? "pounds" : "kilograms"} lifted
      </p>

      {!hasAny && (
        <p className="mb-8 max-w-[65ch] text-sm leading-relaxed text-muted">
          Nothing to chart yet. Progress appears after your first completed
          session on the{" "}
          <Link to="/today" className="font-medium text-ink">
            Today
          </Link>{" "}
          screen.
        </p>
      )}

      <section className="mb-10">
        <h2 className="mb-2 text-[13px] font-medium text-muted">
          Overall volume
        </h2>
        <TrendChart data={overall} height={200} valueLabel={unit} />
      </section>

      <section>
        <h2 className="mb-3 text-[13px] font-medium text-muted">Muscles</h2>
        <div className="mb-6">
          <Physique
            intensities={intensities}
            selected={picked}
            onSelect={setPicked}
          />
          {gender === "female" ? (
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              Blender Studio Human Base Meshes, CC0
            </p>
          ) : null}
        </div>

        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h3 className="text-[15px] font-semibold tracking-tight">
            {REGION_LABEL[selected]}
          </h3>
          {contributors.length === 1 ? (
            <Link
              to={`/exercise/${contributors[0].id}`}
              className="text-[13px] font-medium text-muted transition-colors duration-150 hover:text-ink"
            >
              History
            </Link>
          ) : null}
        </div>
        {contributors.length > 1 ? (
          <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1">
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
        ) : null}
        <TrendChart data={regionTrend} height={140} valueLabel={unit} />
      </section>
    </div>
  );
}
