import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { toLocalISODate } from "../lib/rotation";
import {
  formatDayHeading,
  formatMonthLabel,
  monthCells,
  sessionDatesInRange,
  sessionsForDate,
  shiftMonth,
} from "../lib/history";
import { addGoal, bestWeightFor, deleteGoal } from "../lib/goals";
import { formatWeight } from "../lib/workout";
import { MANUAL_STEP, toCanonical, toDisplay } from "../lib/units";
import { useUnit } from "../lib/settings";
import { ensureExerciseRow, type ExerciseLibraryEntry } from "../lib/library";
import { ExerciseCombobox } from "../components/ExerciseCombobox";
import { Stepper } from "../components/Stepper";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const iconBtn =
  "glass-btn flex h-11 w-11 items-center justify-center rounded-pill text-ink disabled:pointer-events-none disabled:opacity-40";
const secondaryBtn =
  "glass-btn h-11 rounded-pill px-4 text-sm font-medium text-ink";

function ConfirmDelete({ onConfirm }: { onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      className="text-[13px] font-medium text-muted transition-colors duration-150 hover:text-ink"
    >
      {armed ? "Confirm remove" : "Remove"}
    </button>
  );
}

export function History() {
  const [unit] = useUnit();
  const [searchParams, setSearchParams] = useSearchParams();
  const today = useMemo(() => new Date(), []);
  const todayKey = toLocalISODate(today);

  const [cursor, setCursor] = useState(() => ({
    year: today.getFullYear(),
    monthIndex: today.getMonth(),
  }));

  const selectedKey = searchParams.get("day") ?? todayKey;

  const setSelectedKey = (key: string) => {
    setSearchParams({ day: key }, { replace: true });
  };

  const cells = useMemo(
    () => monthCells(cursor.year, cursor.monthIndex),
    [cursor.year, cursor.monthIndex],
  );

  const rangeStart = toLocalISODate(cells[0]);
  const rangeEnd = toLocalISODate(cells[cells.length - 1]);

  const markedDays = useLiveQuery(
    () => sessionDatesInRange(rangeStart, rangeEnd),
    [rangeStart, rangeEnd],
  );

  const daySessions = useLiveQuery(
    () => sessionsForDate(selectedKey),
    [selectedKey],
  );

  const goalsData = useLiveQuery(async () => {
    const [goals, exercises] = await Promise.all([
      db.goals.toArray(),
      db.exercises.toArray(),
    ]);
    const nameById = new Map(exercises.map((e) => [e.id, e.name] as const));
    const withBest = await Promise.all(
      goals
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(async (goal) => ({
          goal,
          name: nameById.get(goal.exerciseId) ?? "Exercise",
          best: await bestWeightFor(goal.exerciseId),
        })),
    );
    return withBest;
  }, []);

  const [addingGoal, setAddingGoal] = useState(false);
  const [pendingExercise, setPendingExercise] =
    useState<ExerciseLibraryEntry | null>(null);
  const [goalWeight, setGoalWeight] = useState(135);

  const goMonth = (delta: number) => {
    setCursor((c) => shiftMonth(c.year, c.monthIndex, delta));
  };

  const onPickExercise = async (entry: ExerciseLibraryEntry) => {
    await ensureExerciseRow(entry);
    setPendingExercise(entry);
    const best = await bestWeightFor(entry.id);
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

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <p className="mt-1 text-sm text-muted">
          Past sessions, corrections, and PR targets
        </p>
      </header>

      <section className="mb-8" aria-label="Training calendar">
        <div className="mb-3 flex items-center justify-between gap-3">
          <button
            type="button"
            className={iconBtn}
            aria-label="Previous month"
            onClick={() => goMonth(-1)}
          >
            <Chevron direction="left" />
          </button>
          <h2 className="text-[15px] font-semibold tracking-tight">
            {formatMonthLabel(cursor.year, cursor.monthIndex)}
          </h2>
          <button
            type="button"
            className={iconBtn}
            aria-label="Next month"
            onClick={() => goMonth(1)}
          >
            <Chevron direction="right" />
          </button>
        </div>

        <div className="glass rounded-xl p-3 shadow-glass sm:p-4">
          <div className="mb-2 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((d) => (
              <span
                key={d}
                className="py-1 text-center text-[12px] font-medium text-muted"
              >
                {d}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((date) => {
              const key = toLocalISODate(date);
              const inMonth = date.getMonth() === cursor.monthIndex;
              const isToday = key === todayKey;
              const isSelected = key === selectedKey;
              const mark = markedDays?.get(key);
              const hasSession = Boolean(mark);

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedKey(key)}
                  aria-label={`${formatDayHeading(key)}${hasSession ? ", session logged" : ""}`}
                  aria-pressed={isSelected}
                  className={[
                    "relative flex h-11 flex-col items-center justify-center rounded-md text-sm transition-[background-color,color,transform] duration-150 ease-out-quint",
                    "active:scale-[0.96]",
                    isSelected
                      ? "bg-glass-highlight text-ink"
                      : inMonth
                        ? "text-ink hover:bg-glass-highlight/60"
                        : "text-muted/50 hover:bg-glass-highlight/40",
                    isToday && !isSelected ? "ring-1 ring-hairline" : "",
                  ].join(" ")}
                >
                  <span className="tnum leading-none">{date.getDate()}</span>
                  {hasSession ? (
                    <span
                      className={[
                        "mt-1 h-1 w-1 rounded-full",
                        isSelected ? "bg-ink" : "bg-muted",
                      ].join(" ")}
                      aria-hidden="true"
                    />
                  ) : (
                    <span className="mt-1 h-1 w-1" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mb-10" aria-labelledby="day-heading">
        <h2
          id="day-heading"
          className="mb-2 text-[13px] font-medium text-muted"
        >
          {formatDayHeading(selectedKey)}
        </h2>

        {daySessions === undefined ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : daySessions.length === 0 ? (
          <p className="max-w-[65ch] text-sm leading-relaxed text-muted">
            {selectedKey === todayKey
              ? "No session logged today yet. Log sets from Today."
              : "No session on this day."}
          </p>
        ) : (
          <ul className="divide-y divide-hairline rounded-md border border-hairline bg-surface">
            {daySessions.map(({ session, dayName, setCount, exerciseCount }) => (
              <li key={session.id}>
                <Link
                  to={`/history/session/${session.id}`}
                  className="flex items-baseline justify-between gap-4 px-4 py-3 transition-colors duration-150 hover:bg-surface-raised"
                >
                  <span>
                    <span className="block text-[15px] font-semibold tracking-tight text-ink">
                      {dayName}
                    </span>
                    <span className="mt-0.5 block text-[13px] text-muted">
                      {setCount === 0
                        ? session.completed
                          ? "Completed · no sets"
                          : "Started · no sets"
                        : `${setCount} ${setCount === 1 ? "set" : "sets"} · ${exerciseCount} ${exerciseCount === 1 ? "exercise" : "exercises"}`}
                      {session.completed ? " · done" : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-[13px] font-medium text-muted">
                    Open
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="goals-heading">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2
            id="goals-heading"
            className="text-lg font-semibold tracking-tight"
          >
            Goals
          </h2>
          {!addingGoal && !pendingExercise ? (
            <button
              type="button"
              className="text-[13px] font-medium text-muted transition-colors duration-150 hover:text-ink"
              onClick={() => setAddingGoal(true)}
            >
              Add PR
            </button>
          ) : null}
        </div>
        <p className="mb-4 max-w-[65ch] text-sm leading-relaxed text-muted">
          Working-set targets. Best is the heaviest set logged for that lift.
        </p>

        {addingGoal && !pendingExercise ? (
          <div className="mb-4">
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
          <div className="mb-4 space-y-4 rounded-xl glass p-4 shadow-glass">
            <p className="text-[15px] font-semibold tracking-tight">
              {pendingExercise.name}
            </p>
            <Stepper
              label={`Target (${unit})`}
              value={goalWeight}
              step={MANUAL_STEP[unit]}
              min={MANUAL_STEP[unit]}
              onChange={setGoalWeight}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary h-11 rounded-pill bg-accent px-5 text-sm font-medium text-bg hover:bg-ink"
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

        {goalsData === undefined ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : goalsData.length === 0 && !addingGoal && !pendingExercise ? (
          <p className="max-w-[65ch] text-sm leading-relaxed text-muted">
            No PR targets yet. Add one for a lift you want to push.
          </p>
        ) : (
          <ul className="divide-y divide-hairline rounded-md border border-hairline bg-surface">
            {goalsData?.map(({ goal, name, best }) => {
              const targetDisplay = toDisplay(goal.targetWeight, unit);
              const bestDisplay = toDisplay(best, unit);
              const reached = best > 0 && best >= goal.targetWeight;
              return (
                <li
                  key={goal.id}
                  className="flex items-baseline justify-between gap-4 px-4 py-3"
                >
                  <span className="min-w-0">
                    <Link
                      to={`/exercise/${goal.exerciseId}`}
                      className="block text-[15px] font-semibold tracking-tight text-ink transition-colors duration-150 hover:text-muted"
                    >
                      {name}
                    </Link>
                    <span className="tnum mt-0.5 block text-[13px] text-muted">
                      Target {formatWeight(targetDisplay)} {unit}
                      {" · "}
                      {best > 0
                        ? `Best ${formatWeight(bestDisplay)} ${unit}`
                        : "No sets logged"}
                      {reached ? " · reached" : ""}
                    </span>
                  </span>
                  <ConfirmDelete onConfirm={() => void deleteGoal(goal.id)} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d={direction === "left" ? "M14 6 8 12l6 6" : "M10 6l6 6-6 6"}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
