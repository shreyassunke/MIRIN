import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { ConfirmDelete } from "../components/ConfirmDelete";
import { ContributionGraph } from "../components/ContributionGraph";
import { ExerciseCombobox } from "../components/ExerciseCombobox";
import { useGoalCeremony } from "../components/GoalCeremony";
import { TrophyMark } from "../components/TrophyMark";
import { Stepper } from "../components/Stepper";
import { db, type Goal } from "../db/db";
import {
  addGoal,
  deleteGoal,
  firstStrike,
  formatRecordDate,
  isGoalMet,
} from "../lib/goals";
import {
  allTimeBests,
  contributionYears,
  formatDayHeading,
  indexTrainingDays,
  parseDateKey,
  setsOnDay,
  trailingContribution,
  yearContribution,
  type TrainingSession,
} from "../lib/history";
import { ensureExerciseRow, type ExerciseLibraryEntry } from "../lib/library";
import { toLocalISODate } from "../lib/rotation";
import { useUnit } from "../lib/settings";
import { MANUAL_STEP, toCanonical, toDisplay, type Unit } from "../lib/units";
import { formatWeight } from "../lib/workout";

const secondaryBtn =
  "glass-btn h-11 rounded-pill px-4 text-sm font-medium text-ink";

function readYear(value: string | null, current: number): number | null {
  if (!value || !/^\d{4}$/.test(value)) return null;
  const year = Number(value);
  if (year >= current || year < 1970) return null;
  return year;
}

interface GoalRow {
  goal: Goal;
  name: string;
  equipment?: string;
  best: number;
  /** Earliest session that met the target, when the goal row has not been stamped yet. */
  struckAt: string | null;
  struckWeight: number | null;
}

export function History() {
  const [unit] = useUnit();
  const [searchParams, setSearchParams] = useSearchParams();
  const today = useMemo(() => new Date(), []);
  const todayKey = toLocalISODate(today);
  const currentYear = today.getFullYear();
  const year = readYear(searchParams.get("year"), currentYear);

  const rawDay = searchParams.get("day");
  const selectedKey = rawDay && parseDateKey(rawDay) ? rawDay : todayKey;

  const { replay } = useGoalCeremony();
  const [addingGoal, setAddingGoal] = useState(false);
  const [pendingExercise, setPendingExercise] =
    useState<ExerciseLibraryEntry | null>(null);
  const [goalWeight, setGoalWeight] = useState(135);

  const patchParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value == null || value === "") next.delete(key);
      else next.set(key, value);
    }
    setSearchParams(next, { replace: true });
  };

  const selectDay = (key: string) => {
    patchParams({ day: key === todayKey ? null : key });
  };

  const data = useLiveQuery(async () => {
    const [sessions, logs, templates, goals, exercises] = await Promise.all([
      db.sessions.toArray(),
      db.setLogs.toArray(),
      db.dayTemplates.toArray(),
      db.goals.toArray(),
      db.exercises.toArray(),
    ]);
    return { sessions, logs, templates, goals, exercises };
  }, []);

  const index = useMemo(
    () =>
      data
        ? indexTrainingDays(data.sessions, data.logs, data.templates)
        : null,
    [data],
  );
  const bests = useMemo(
    () => (data ? allTimeBests(data.logs) : null),
    [data],
  );

  const goals = useMemo<GoalRow[]>(() => {
    if (!data || !bests) return [];
    const exerciseById = new Map(data.exercises.map((e) => [e.id, e] as const));
    return data.goals
      .map((goal) => {
        const strike = firstStrike(
          data.logs,
          data.sessions,
          goal.exerciseId,
          goal.targetWeight,
        );
        const exercise = exerciseById.get(goal.exerciseId);
        return {
          goal,
          name: exercise?.name ?? "Exercise",
          equipment: exercise?.equipment,
          best: bests.get(goal.exerciseId) ?? 0,
          struckAt: strike?.at ?? null,
          struckWeight: strike?.weight ?? null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data, bests]);

  const openGoals = useMemo(
    () => goals.filter((row) => !isGoalMet(row.goal, row.best)),
    [goals],
  );
  const records = useMemo(
    () =>
      goals
        .filter((row) => isGoalMet(row.goal, row.best))
        .sort((a, b) => {
          const aAt = a.goal.achievedAt ?? a.struckAt ?? "";
          const bAt = b.goal.achievedAt ?? b.struckAt ?? "";
          return bAt.localeCompare(aAt) || a.name.localeCompare(b.name);
        }),
    [goals],
  );

  const focused =
    openGoals.find((row) => row.goal.id === searchParams.get("goal")) ?? null;

  const calendar = useMemo(
    () =>
      year == null ? trailingContribution(today) : yearContribution(year, today),
    [year, today],
  );

  const exerciseId = focused?.goal.exerciseId ?? null;
  const setsByDay = useMemo(() => {
    const map = new Map<string, number>();
    if (!index) return map;
    for (const [key, day] of index) {
      const sets = setsOnDay(day, exerciseId);
      if (sets > 0) map.set(key, sets);
    }
    return map;
  }, [index, exerciseId]);

  const totalSets = useMemo(() => {
    let total = 0;
    for (const column of calendar.columns) {
      for (const day of column.days) {
        if (day.counts) total += setsByDay.get(day.key) ?? 0;
      }
    }
    return total;
  }, [calendar, setsByDay]);

  const years = useMemo(
    () => contributionYears(index?.keys() ?? [], today),
    [index, today],
  );

  const rangeName = year == null ? "the last year" : String(year);

  const goToday = () => {
    patchParams({ day: null, year: null });
  };

  const setYear = (next: number) => {
    patchParams({ year: next === currentYear ? null : String(next) });
  };

  const toggleGoal = (id: string) => {
    patchParams({ goal: focused?.goal.id === id ? null : id });
  };

  const onPickExercise = async (entry: ExerciseLibraryEntry) => {
    await ensureExerciseRow(entry);
    setPendingExercise(entry);
    const best = bests?.get(entry.id) ?? 0;
    const displayBest = best > 0 ? toDisplay(best, unit) : 0;
    setGoalWeight(
      displayBest > 0
        ? Math.round((displayBest + MANUAL_STEP[unit]) / MANUAL_STEP[unit]) *
            MANUAL_STEP[unit]
        : unit === "lb"
          ? 135
          : 60,
    );
  };

  const saveGoal = async () => {
    if (!pendingExercise) return;
    await addGoal(pendingExercise.id, toCanonical(goalWeight, unit));
    setPendingExercise(null);
    setAddingGoal(false);
  };

  const selectedDay = index?.get(selectedKey);
  const sessions = selectedDay?.sessions ?? [];
  const focusedLogged =
    focused != null &&
    sessions.some((session) =>
      session.exercises.some(
        (exercise) => exercise.exerciseId === focused.goal.exerciseId,
      ),
    );

  return (
    <div>
      <header className="mb-5 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        {selectedKey !== todayKey || year != null ? (
          <button
            type="button"
            className="text-[13px] font-medium text-muted transition-colors duration-150 ease-out-expo hover:text-ink"
            onClick={goToday}
          >
            Today
          </button>
        ) : null}
      </header>

      <section className="mb-5" aria-label="Goals">
        {data === undefined ? (
          <p className="text-[15px] text-muted">Loading…</p>
        ) : (
          <div className="flex items-stretch gap-2 overflow-x-auto no-scrollbar">
            {openGoals.map((row) => (
              <GoalBadge
                key={row.goal.id}
                row={row}
                unit={unit}
                pressed={focused?.goal.id === row.goal.id}
                onToggle={() => toggleGoal(row.goal.id)}
                onRemove={() => {
                  if (focused?.goal.id === row.goal.id) patchParams({ goal: null });
                  void deleteGoal(row.goal.id);
                }}
              />
            ))}
            {openGoals.length === 0 &&
            records.length === 0 &&
            !addingGoal &&
            !pendingExercise ? (
              <p className="self-center text-[15px] text-muted">No targets yet.</p>
            ) : null}
            {!addingGoal && !pendingExercise ? (
              <button
                type="button"
                className="shrink-0 self-center px-2 text-[13px] font-medium text-muted transition-colors duration-150 ease-out-expo hover:text-ink"
                onClick={() => setAddingGoal(true)}
              >
                Add target
              </button>
            ) : null}
          </div>
        )}

        {addingGoal && !pendingExercise ? (
          <div className="mt-3">
            <ExerciseCombobox
              label="Exercise"
              placeholder="Search exercises"
              autoFocus
              onPick={(entry) => void onPickExercise(entry)}
              onCancel={() => setAddingGoal(false)}
            />
          </div>
        ) : null}

        {pendingExercise ? (
          <div className="mt-3 border-y border-hairline py-4">
            <p className="mb-3 text-[15px] font-semibold tracking-tight">
              {pendingExercise.name}
            </p>
            <Stepper
              label={`Target (${unit})`}
              value={goalWeight}
              step={MANUAL_STEP[unit]}
              min={MANUAL_STEP[unit]}
              onChange={setGoalWeight}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary h-11 rounded-pill px-5 text-sm font-medium"
                onClick={() => void saveGoal()}
              >
                Save goal
              </button>
              <button
                type="button"
                className={secondaryBtn}
                onClick={() => {
                  setPendingExercise(null);
                  setAddingGoal(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="mb-8" aria-label="Training calendar">
        <div className="contrib-frame">
          <p className="contrib-summary text-[15px] tracking-tight">
            {data === undefined ? (
              <span className="text-muted">Loading…</span>
            ) : (
              <>
                <span className="tnum font-semibold text-ink">{totalSets}</span>
                <span className="font-medium text-ink">
                  {" "}
                  {totalSets === 1 ? "set" : "sets"}
                  {focused ? ` of ${focused.name}` : ""} in {rangeName}
                </span>
              </>
            )}
          </p>
          <div
            className="contrib-years no-scrollbar"
            role="group"
            aria-label="Year"
          >
            {years.map((item) => {
              const pressed = item === currentYear ? year == null : item === year;
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={pressed}
                  aria-label={
                    item === currentYear ? `${item}, last 12 months` : String(item)
                  }
                  className="contrib-year tnum"
                  onClick={() => setYear(item)}
                >
                  {item}
                </button>
              );
            })}
          </div>
          <div className="contrib-plot">
            <ContributionGraph
              calendar={calendar}
              setsByDay={setsByDay}
              selectedKey={selectedKey}
              onSelect={selectDay}
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="day-heading">
        <h2 id="day-heading" className="mb-3 text-[13px] font-medium text-muted">
          {formatDayHeading(selectedKey)}
        </h2>

        {data === undefined ? (
          <p className="text-[15px] text-muted">Loading…</p>
        ) : sessions.length === 0 ? (
          focused ? (
            <p className="text-[15px]">
              <span className="font-medium text-ink">{focused.name}</span>
              <span className="text-muted"> not logged.</span>
            </p>
          ) : (
            <p className="text-[15px] text-muted">
              {selectedKey === todayKey
                ? "No session logged today yet."
                : "No session on this day."}
            </p>
          )
        ) : (
          <>
            {focused && !focusedLogged ? (
              <p className="mb-3 text-[15px]">
                <span className="font-medium text-ink">{focused.name}</span>
                <span className="text-muted"> not logged.</span>
              </p>
            ) : null}
            <ul className="divide-y divide-hairline border-y border-hairline">
              {sessions.map((session) => (
                <SessionRow
                  key={session.session.id}
                  session={session}
                  goals={openGoals}
                  focusedId={focused?.goal.id ?? null}
                  unit={unit}
                />
              ))}
            </ul>
          </>
        )}
      </section>

      {records.length > 0 ? (
        <section className="mt-10" aria-labelledby="records-heading">
          <h2 id="records-heading" className="mb-3 text-[13px] font-medium text-muted">
            Records
          </h2>
          <ul className="divide-y divide-hairline border-y border-hairline">
            {records.map((row) => {
              const weightLb = row.goal.achievedWeight ?? row.struckWeight ?? row.best;
              const at = row.goal.achievedAt ?? row.struckAt ?? row.goal.createdAt;
              const weight = formatWeight(toDisplay(weightLb, unit));
              const date = formatRecordDate(at);
              return (
                <li key={row.goal.id}>
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center gap-3 py-3 text-left transition-colors duration-150 ease-out-expo hover:bg-wash"
                    onClick={() =>
                      replay({
                        goalId: row.goal.id,
                        name: row.name,
                        equipment: row.equipment,
                        weightLb,
                        achievedAt: at,
                      })
                    }
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center">
                      <TrophyMark className="h-10 w-10" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold tracking-tight text-ink">
                        {row.name}
                      </span>
                      <span className="mt-0.5 block text-[13px] text-muted">{date}</span>
                    </span>
                    <span className="tnum shrink-0 text-[15px] font-semibold tracking-tight text-ink">
                      {weight} {unit}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function GoalBadge({
  row,
  unit,
  pressed,
  onToggle,
  onRemove,
}: {
  row: GoalRow;
  unit: Unit;
  pressed: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={[
        "shrink-0 rounded-md border border-hairline px-3 py-2 transition-colors duration-150 ease-out-expo",
        pressed ? "bg-glass-highlight" : "",
      ].join(" ")}
    >
      <button
        type="button"
        aria-pressed={pressed}
        onClick={onToggle}
        className="block max-w-[11rem] text-left"
      >
        <span
          className={[
            "block truncate text-[13px] font-medium",
            pressed ? "text-ink" : "text-muted",
          ].join(" ")}
        >
          {row.name}
        </span>
        <span className="mt-0.5 block">
          <WeightRatio best={row.best} target={row.goal.targetWeight} unit={unit} />
        </span>
      </button>
      {pressed ? (
        <div className="mt-2 flex items-center gap-3">
          <Link
            to={`/exercise/${row.goal.exerciseId}`}
            className="text-[13px] font-medium text-muted transition-colors duration-150 ease-out-expo hover:text-ink"
          >
            All sets
          </Link>
          <ConfirmDelete onConfirm={onRemove} />
        </div>
      ) : null}
    </div>
  );
}

function SessionRow({
  session,
  goals,
  focusedId,
  unit,
}: {
  session: TrainingSession;
  goals: GoalRow[];
  focusedId: string | null;
  unit: Unit;
}) {
  const hits = goals
    .map((row) => {
      const exercise = session.exercises.find(
        (item) => item.exerciseId === row.goal.exerciseId,
      );
      return exercise ? { row, dayBest: exercise.best } : null;
    })
    .filter((hit) => hit != null)
    .sort((a, b) => {
      if (a.row.goal.id === focusedId) return -1;
      if (b.row.goal.id === focusedId) return 1;
      return 0;
    });

  const meta =
    session.setCount === 0
      ? session.session.completed
        ? "Completed · no sets"
        : "Started · no sets"
      : `${session.setCount} ${session.setCount === 1 ? "set" : "sets"} · ${session.exerciseCount} ${session.exerciseCount === 1 ? "exercise" : "exercises"}${session.session.completed ? " · done" : ""}`;

  return (
    <li>
      <Link
        to={`/history/session/${session.session.id}`}
        className="block py-3 transition-colors duration-150 ease-out-expo hover:bg-wash"
      >
        <span className="block text-[15px] font-semibold tracking-tight text-ink">
          {session.dayName}
        </span>
        {hits.map((hit) => (
          <span
            key={hit.row.goal.id}
            className="mt-1 flex items-baseline justify-between gap-3"
          >
            <span className="min-w-0 truncate text-[13px] text-muted">
              {hit.row.name}
            </span>
            <WeightRatio
              best={hit.dayBest}
              target={hit.row.goal.targetWeight}
              unit={unit}
              size={hit.row.goal.id === focusedId ? "lg" : "md"}
            />
          </span>
        ))}
        <span className="mt-1 block text-[13px] text-muted">{meta}</span>
      </Link>
    </li>
  );
}

function WeightRatio({
  best,
  target,
  unit,
  size = "md",
}: {
  best: number;
  target: number;
  unit: Unit;
  size?: "md" | "lg";
}) {
  const met = best > 0 && best >= target;
  const bestText = best > 0 ? formatWeight(toDisplay(best, unit)) : "—";
  const targetText = formatWeight(toDisplay(target, unit));
  const bestClass =
    size === "lg"
      ? "text-xl font-semibold tracking-tight"
      : "text-[15px] font-semibold tracking-tight";
  return (
    <span className="tnum whitespace-nowrap">
      <span className={best > 0 ? `${bestClass} text-ink` : "text-[15px] font-medium text-muted"}>
        {bestText}
      </span>
      <span
        className={
          met
            ? "text-[13px] font-semibold text-ink"
            : "text-[13px] font-medium text-muted"
        }
      >
        {" / "}
        {targetText} {unit}
      </span>
    </span>
  );
}
