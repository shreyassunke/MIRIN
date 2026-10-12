import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { ConfirmDelete } from "../components/ConfirmDelete";
import { ExerciseCombobox } from "../components/ExerciseCombobox";
import { Stepper } from "../components/Stepper";
import { chipClass, chipTrackClass } from "../components/chip";
import { db, type Goal } from "../db/db";
import { addGoal, deleteGoal } from "../lib/goals";
import {
  addDays,
  allTimeBests,
  formatDayHeading,
  formatMonthLabel,
  formatWeekLabel,
  indexTrainingDays,
  monthCells,
  parseDateKey,
  shiftMonth,
  weekCells,
  type TrainingDay,
  type TrainingSession,
} from "../lib/history";
import { ensureExerciseRow, type ExerciseLibraryEntry } from "../lib/library";
import { toLocalISODate } from "../lib/rotation";
import { useUnit } from "../lib/settings";
import { MANUAL_STEP, toCanonical, toDisplay, type Unit } from "../lib/units";
import { formatWeight } from "../lib/workout";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const VIEWS = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "day", label: "Day" },
] as const;

type CalendarView = (typeof VIEWS)[number]["id"];

const iconBtn =
  "glass-btn flex h-11 w-11 items-center justify-center rounded-pill text-ink disabled:pointer-events-none disabled:opacity-40";
const secondaryBtn =
  "glass-btn h-11 rounded-pill px-4 text-sm font-medium text-ink";

interface GoalRow {
  goal: Goal;
  name: string;
  best: number;
}

function readView(value: string | null): CalendarView {
  if (value === "week" || value === "day") return value;
  return "month";
}

export function History() {
  const [unit] = useUnit();
  const [searchParams, setSearchParams] = useSearchParams();
  const today = useMemo(() => new Date(), []);
  const todayKey = toLocalISODate(today);
  const view = readView(searchParams.get("view"));

  const rawDay = searchParams.get("day");
  const selectedKey = rawDay && parseDateKey(rawDay) ? rawDay : todayKey;

  const [cursor, setCursor] = useState(() => today);
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
    const nameById = new Map(data.exercises.map((e) => [e.id, e.name] as const));
    return data.goals
      .map((goal) => ({
        goal,
        name: nameById.get(goal.exerciseId) ?? "Exercise",
        best: bests.get(goal.exerciseId) ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data, bests]);

  const focused =
    goals.find((row) => row.goal.id === searchParams.get("goal")) ?? null;

  const cells = useMemo(() => {
    if (view === "week") return weekCells(cursor);
    if (view === "day") return [parseDateKey(selectedKey) ?? today];
    return monthCells(cursor.getFullYear(), cursor.getMonth());
  }, [view, cursor, selectedKey, today]);

  const rangeLabel =
    view === "day"
      ? formatDayHeading(selectedKey)
      : view === "week"
        ? formatWeekLabel(cells[0], cells[cells.length - 1])
        : formatMonthLabel(cursor.getFullYear(), cursor.getMonth());

  const stepName = view === "month" ? "month" : view === "week" ? "week" : "day";

  const setView = (next: CalendarView) => {
    setCursor(parseDateKey(selectedKey) ?? today);
    patchParams({ view: next === "month" ? null : next });
  };

  const step = (delta: number) => {
    if (view === "day") {
      const date = addDays(parseDateKey(selectedKey) ?? today, delta);
      setCursor(date);
      const key = toLocalISODate(date);
      patchParams({ day: key === todayKey ? null : key });
      return;
    }
    if (view === "week") {
      setCursor((current) => addDays(current, delta * 7));
      return;
    }
    setCursor((current) => {
      const shifted = shiftMonth(current.getFullYear(), current.getMonth(), delta);
      return new Date(shifted.year, shifted.monthIndex, 1);
    });
  };

  const goToday = () => {
    setCursor(today);
    patchParams({ day: null });
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
      <header className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <div className="flex items-center gap-3">
          {selectedKey !== todayKey ? (
            <button
              type="button"
              className="text-[13px] font-medium text-muted transition-colors duration-150 ease-out-expo hover:text-ink"
              onClick={goToday}
            >
              Today
            </button>
          ) : null}
          <div role="group" aria-label="Calendar view" className={chipTrackClass}>
            {VIEWS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={view === item.id}
                onClick={() => setView(item.id)}
                className={`${chipClass(view === item.id)} h-9 px-3 text-[13px]`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="mb-5" aria-label="Goals">
        {data === undefined ? (
          <p className="text-[15px] text-muted">Loading…</p>
        ) : (
          <div className="flex items-stretch gap-2 overflow-x-auto no-scrollbar">
            {goals.map((row) => (
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
            {goals.length === 0 && !addingGoal && !pendingExercise ? (
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
        <div className="mb-3 flex items-center justify-between gap-3">
          <button
            type="button"
            className={iconBtn}
            aria-label={`Previous ${stepName}`}
            onClick={() => step(-1)}
          >
            <Chevron direction="left" />
          </button>
          <h2
            id={view === "day" ? "day-heading" : undefined}
            className="min-w-0 truncate text-center text-[15px] font-semibold tracking-tight"
          >
            {rangeLabel}
          </h2>
          <button
            type="button"
            className={iconBtn}
            aria-label={`Next ${stepName}`}
            onClick={() => step(1)}
          >
            <Chevron direction="right" />
          </button>
        </div>

        {view === "month" ? (
          <div className="glass rounded-xl p-3 shadow-glass sm:p-4">
            <div className="mb-2 grid grid-cols-7 gap-1">
              {WEEKDAYS.map((day) => (
                <span
                  key={day}
                  className="py-1 text-center text-[12px] font-medium text-muted"
                >
                  {day}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((date) => (
                <DayCell
                  key={toLocalISODate(date)}
                  date={date}
                  inView={date.getMonth() === cursor.getMonth()}
                  todayKey={todayKey}
                  selectedKey={selectedKey}
                  mark={markFor(index?.get(toLocalISODate(date)), goals, focused)}
                  names={sessionNames(index?.get(toLocalISODate(date)))}
                  focusedName={focused?.name ?? null}
                  compact
                  onSelect={selectDay}
                />
              ))}
            </div>
          </div>
        ) : null}

        {view === "week" ? (
          <div className="glass rounded-xl p-2 shadow-glass sm:p-3">
            <div className="grid grid-cols-7 gap-1">
              {cells.map((date) => (
                <DayCell
                  key={toLocalISODate(date)}
                  date={date}
                  inView
                  todayKey={todayKey}
                  selectedKey={selectedKey}
                  mark={markFor(index?.get(toLocalISODate(date)), goals, focused)}
                  names={sessionNames(index?.get(toLocalISODate(date)))}
                  focusedName={focused?.name ?? null}
                  onSelect={selectDay}
                />
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="day-heading">
        {view === "day" ? null : (
          <h2 id="day-heading" className="mb-3 text-[13px] font-medium text-muted">
            {formatDayHeading(selectedKey)}
          </h2>
        )}

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
                  goals={goals}
                  focusedId={focused?.goal.id ?? null}
                  unit={unit}
                />
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

function markFor(
  day: TrainingDay | undefined,
  goals: GoalRow[],
  focused: GoalRow | null,
): "goal" | "session" | "none" {
  if (!day?.marked) return "none";
  const ids = focused
    ? [focused.goal.exerciseId]
    : goals.map((row) => row.goal.exerciseId);
  const hit = ids.some((id) => (day.bestByExercise.get(id) ?? 0) > 0);
  if (hit) return "goal";
  return "session";
}

function sessionNames(day: TrainingDay | undefined): string[] {
  if (!day) return [];
  return day.sessions.map((session) => session.dayName);
}

function DayCell({
  date,
  inView,
  todayKey,
  selectedKey,
  mark,
  names,
  focusedName,
  compact = false,
  onSelect,
}: {
  date: Date;
  inView: boolean;
  todayKey: string;
  selectedKey: string;
  mark: "goal" | "session" | "none";
  names: string[];
  focusedName: string | null;
  compact?: boolean;
  onSelect: (key: string) => void;
}) {
  const key = toLocalISODate(date);
  const isToday = key === todayKey;
  const isSelected = key === selectedKey;
  const sessionLabel =
    names.length > 1 ? `${names.length} sessions` : (names[0] ?? "");
  const bits = [formatDayHeading(key)];
  if (sessionLabel) bits.push(sessionLabel);
  if (mark === "goal") bits.push(focusedName ? `${focusedName} logged` : "target logged");
  else if (mark === "session") bits.push("session logged");

  return (
    <button
      type="button"
      onClick={() => onSelect(key)}
      aria-label={bits.join(", ")}
      aria-pressed={isSelected}
      className={[
        "relative flex flex-col items-center justify-center rounded-md transition-[background-color,color,transform] duration-150 ease-out-expo",
        "active:scale-[0.96]",
        compact ? "h-11" : "min-h-14 px-0.5 py-2 sm:min-h-[4.75rem]",
        isSelected
          ? "bg-glass-highlight text-ink"
          : inView
            ? "text-ink hover:bg-glass-highlight/60"
            : "text-muted hover:bg-glass-highlight/40",
        isToday && !isSelected ? "ring-1 ring-hairline" : "",
      ].join(" ")}
    >
      {compact ? null : (
        <span className="text-[12px] font-medium text-muted">
          {WEEKDAYS[date.getDay()]}
        </span>
      )}
      <span
        className={[
          "tnum leading-none",
          compact ? "text-sm" : "mt-1 text-[15px] font-semibold",
        ].join(" ")}
      >
        {date.getDate()}
      </span>
      {compact ? null : (
        <span className="mt-1 hidden w-full truncate text-center text-[12px] text-muted sm:block">
          {sessionLabel || "\u00a0"}
        </span>
      )}
      <span
        className={[
          "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
          mark === "goal"
            ? "bg-ink"
            : mark === "session"
              ? "border border-muted"
              : "",
        ].join(" ")}
        aria-hidden="true"
      />
    </button>
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
