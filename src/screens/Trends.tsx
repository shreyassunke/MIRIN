import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type SetLog, type WorkoutSession } from "../db/db";
import { formatDate } from "../lib/workout";
import { toDisplay, type Unit } from "../lib/units";
import { useUnit } from "../lib/settings";
import { TrendChart, type TrendPoint } from "../components/TrendChart";

/** The priority lifts to watch separately (shoulder/lat width levers). */
const WEAK_POINTS: { label: string; exerciseIds: string[] }[] = [
  { label: "Lateral Raise", exerciseIds: ["lateral-raise"] },
  { label: "Rear Delt Flye", exerciseIds: ["rear-delt-flye"] },
  {
    label: "Incline Press",
    exerciseIds: ["incline-barbell-press", "incline-db-press"],
  },
];

function volumeTrend(
  sessions: WorkoutSession[],
  logs: SetLog[],
  unit: Unit,
  exerciseIds?: string[],
): TrendPoint[] {
  const filter = exerciseIds ? new Set(exerciseIds) : null;
  const bySession = new Map<string, number>();
  for (const log of logs) {
    if (filter && !filter.has(log.exerciseId)) continue;
    bySession.set(
      log.sessionId,
      (bySession.get(log.sessionId) ?? 0) + log.weight * log.reps,
    );
  }
  return sessions
    .filter((s) => s.completed && bySession.has(s.id))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => ({
      date: formatDate(s.date),
      value: toDisplay(bySession.get(s.id)!, unit),
    }));
}

export function Trends() {
  const [unit] = useUnit();
  const data = useLiveQuery(async () => {
    const [sessions, logs] = await Promise.all([
      db.sessions.toArray(),
      db.setLogs.toArray(),
    ]);
    return { sessions, logs };
  }, []);

  if (!data) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  const overall = volumeTrend(data.sessions, data.logs, unit);
  const hasAny = data.logs.length > 0;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Trends</h1>
        <p className="mt-1 text-sm text-muted">
          Volume per completed session, in{" "}
          {unit === "lb" ? "pounds" : "kilograms"} lifted
        </p>
      </header>

      {!hasAny && (
        <p className="mb-8 max-w-[65ch] text-sm leading-relaxed text-muted">
          Nothing to chart yet. Trends appear after your first completed
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
        <h2 className="mb-1 text-lg font-semibold tracking-tight">
          Weak points
        </h2>
        <p className="mb-4 max-w-[65ch] text-sm leading-relaxed text-muted">
          The lifts tracked separately: shoulder and lat width are the main
          visual levers.
        </p>
        <div className="space-y-6">
          {WEAK_POINTS.map((wp) => (
            <div key={wp.label}>
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-[15px] font-semibold tracking-tight">
                  {wp.label}
                </h3>
                {wp.exerciseIds.length === 1 && (
                  <Link
                    to={`/exercise/${wp.exerciseIds[0]}`}
                    className="text-[13px] font-medium text-muted transition-colors duration-150 hover:text-ink"
                  >
                    History
                  </Link>
                )}
              </div>
              <TrendChart
                data={volumeTrend(data.sessions, data.logs, unit, wp.exerciseIds)}
                height={140}
                valueLabel={unit}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
