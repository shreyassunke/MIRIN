import { Link, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type LoadBreakdown, type SetLog } from "../db/db";
import {
  epley,
  exerciseHistory,
  formatDate,
  formatWeight,
} from "../lib/workout";
import { toDisplay, type Unit } from "../lib/units";
import { useUnit } from "../lib/settings";
import { TrendChart, type TrendPoint } from "../components/TrendChart";

/** "Bar 45 + 45 · 25 per side" from the stored canonical breakdown. */
function breakdownText(breakdown: LoadBreakdown, unit: Unit): string | null {
  if (!breakdown.platesPerSide?.length) return null;
  const plates = breakdown.platesPerSide
    .map((p) => formatWeight(toDisplay(p, unit)))
    .join(" · ");
  const bar =
    breakdown.barWeight !== undefined
      ? `Bar ${formatWeight(toDisplay(breakdown.barWeight, unit))} + `
      : "";
  return `${bar}${plates} per side`;
}

/** The heaviest set's breakdown represents the session. */
function sessionBreakdown(sets: SetLog[], unit: Unit): string | null {
  const withBreakdown = sets.filter((s) => s.loadBreakdown?.platesPerSide?.length);
  if (withBreakdown.length === 0) return null;
  const top = withBreakdown.reduce((a, b) => (b.weight > a.weight ? b : a));
  return breakdownText(top.loadBreakdown!, unit);
}

export function ExerciseDetail() {
  const { id } = useParams<{ id: string }>();
  const [unit] = useUnit();

  const data = useLiveQuery(async () => {
    if (!id) return undefined;
    const exercise = await db.exercises.get(id);
    if (!exercise) return null;
    const history = await exerciseHistory(id, { limit: 10 });
    return { exercise, history };
  }, [id]);

  if (data === undefined) {
    return <p className="text-sm text-muted">Loading…</p>;
  }
  if (data === null) {
    return (
      <div>
        <p className="text-sm text-muted">Exercise not found.</p>
        <Link
          to="/today"
          className="mt-2 inline-block text-sm font-medium text-ink"
        >
          Back to today
        </Link>
      </div>
    );
  }

  const { exercise, history } = data;

  // Oldest → newest for the trend; best (highest) estimated 1RM per session.
  const trend: TrendPoint[] = [...history]
    .reverse()
    .map(({ session, sets }) => ({
      date: formatDate(session.date),
      value: toDisplay(
        Math.max(...sets.map((s) => epley(s.weight, s.reps))),
        unit,
      ),
    }));

  return (
    <div>
      <header className="mb-6">
        <Link
          to="/today"
          className="text-[13px] font-medium text-muted transition-colors duration-150 hover:text-ink"
        >
          Today
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {exercise.name}
        </h1>
        <p className="mt-1 text-sm text-muted">{exercise.muscleGroup}</p>
      </header>

      <section className="mb-8">
        <h2 className="mb-2 text-[13px] font-medium text-muted">
          Estimated 1RM
        </h2>
        <TrendChart data={trend} sparkline height={96} valueLabel={unit} />
      </section>

      <section>
        <h2 className="mb-2 text-[13px] font-medium text-muted">
          {history.length === 0
            ? "History"
            : history.length === 1
              ? "Last session"
              : `Last ${history.length} sessions`}
        </h2>
        {history.length === 0 ? (
          <p className="max-w-[65ch] text-sm leading-relaxed text-muted">
            No sessions yet. Log this exercise from the Today screen and its
            history will build here.
          </p>
        ) : (
          <ul className="divide-y divide-hairline rounded-md border border-hairline bg-surface">
            {history.map(({ session, sets }) => {
              const breakdown = sessionBreakdown(sets, unit);
              return (
                <li
                  key={session.id}
                  className="flex items-baseline justify-between gap-4 px-4 py-3"
                >
                  <span>
                    <span className="tnum block text-sm text-ink">
                      {sets
                        .map(
                          (s) =>
                            `${formatWeight(toDisplay(s.weight, unit))}×${s.reps}`,
                        )
                        .join("  ")}
                    </span>
                    {breakdown && (
                      <span className="tnum mt-0.5 block text-[12px] text-muted">
                        {breakdown}
                      </span>
                    )}
                  </span>
                  <span className="tnum shrink-0 text-[13px] text-muted">
                    {formatDate(session.date)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
