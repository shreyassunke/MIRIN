import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  db,
  type Exercise,
  type LoadBreakdown,
  type SetLog,
} from "../db/db";
import {
  DEFAULT_REST_SECONDS,
  DEFAULT_TARGET_SETS,
  defaultInputMethodFor,
  defaultRepsFor,
  formatWeight,
  lastSets,
  newId,
  startWeightFor,
} from "../lib/workout";
import { dayTemplateIdForDate, nextWorkout } from "../lib/rotation";
import { REST_DAY_TEMPLATE } from "../db/seed";
import { ensureExerciseRow } from "../lib/library";
import { ExerciseCombobox } from "../components/ExerciseCombobox";
import {
  DEFAULT_BAR,
  MANUAL_STEP,
  decomposePlates,
  nearestDumbbell,
  round2,
  toCanonical,
  toDisplay,
  type InputMethod,
} from "../lib/units";
import { useUnit } from "../lib/settings";
import { Stepper } from "../components/Stepper";
import { RestTimer } from "../components/RestTimer";
import { UnitToggle } from "../components/UnitToggle";
import { BarbellPicker } from "../components/weight/BarbellPicker";
import { DumbbellPicker } from "../components/weight/DumbbellPicker";

interface TodayData {
  dayTemplateId: string | null;
  dayName: string;
  exercises: Exercise[];
  sessionId: string | null;
  /** Ids already on today's list (scheduled + ad-hoc). */
  exerciseIds: string[];
  logs: SetLog[];
  prefills: Record<string, SetLog[]>;
  modePrefs: Record<string, InputMethod>;
  isRestDay: boolean;
  nextUp: { dayName: string; daysAway: number } | null;
}

function useTodayData(): TodayData | undefined {
  return useLiveQuery(async () => {
    // The active split drives today; a lone split acts as active.
    const split =
      (await db.splits.filter((s) => s.isActive).first()) ??
      (await db.splits.toCollection().first());
    if (!split) return undefined;

    const sessions = await db.sessions.toArray();
    const open = sessions
      .filter((s) => !s.completed)
      .sort((a, b) => b.date.localeCompare(a.date))[0];

    const today = new Date();
    const allDays = new Map(
      (await db.dayTemplates.toArray()).map((d) => [d.id, d] as const),
    );
    const isRest = (id: string) =>
      (allDays.get(id)?.isRestDay ?? false) ||
      (allDays.get(id)?.exerciseIds.length ?? 0) === 0;

    const scheduledId = dayTemplateIdForDate(split, today);

    // An open session pins its own day; if its template was deleted
    // (split removed mid-session), fall back to today's schedule.
    let dayTemplateId = open ? open.dayTemplateId : scheduledId;
    if (dayTemplateId && !allDays.get(dayTemplateId)) {
      dayTemplateId = scheduledId;
    }
    const day = dayTemplateId ? allDays.get(dayTemplateId) : undefined;

    if (!day || day.isRestDay) {
      const upcoming = nextWorkout(split, isRest, today, 1);
      const extraIds = open?.extraExerciseIds ?? [];
      const exercises =
        extraIds.length > 0
          ? (await db.exercises.bulkGet(extraIds)).filter(
              (e): e is Exercise => e !== undefined,
            )
          : [];
      const logs = open
        ? await db.setLogs.where("sessionId").equals(open.id).toArray()
        : [];
      const prefills: Record<string, SetLog[]> = {};
      for (const exercise of exercises) {
        prefills[exercise.id] = await lastSets(exercise.id, open?.id);
      }
      const modePrefs: Record<string, InputMethod> = {};
      for (const pref of await db.exercisePrefs.toArray()) {
        modePrefs[pref.exerciseId] = pref.preferredInputMethod;
      }
      return {
        dayTemplateId: null,
        dayName: extraIds.length > 0 ? "Extra work" : "Rest day",
        exercises,
        sessionId: open?.id ?? null,
        exerciseIds: extraIds,
        logs,
        prefills,
        modePrefs,
        isRestDay: !open && extraIds.length === 0,
        nextUp: upcoming
          ? {
              dayName: allDays.get(upcoming.dayTemplateId)?.name ?? "",
              daysAway: upcoming.daysAway,
            }
          : null,
      };
    }

    const exerciseIds = [
      ...day.exerciseIds,
      ...(open?.extraExerciseIds?.filter((id) => !day.exerciseIds.includes(id)) ??
        []),
    ];
    const exercises = (await db.exercises.bulkGet(exerciseIds)).filter(
      (e): e is Exercise => e !== undefined,
    );

    const logs = open
      ? await db.setLogs.where("sessionId").equals(open.id).toArray()
      : [];

    const prefills: Record<string, SetLog[]> = {};
    for (const exercise of exercises) {
      prefills[exercise.id] = await lastSets(exercise.id, open?.id);
    }

    const modePrefs: Record<string, InputMethod> = {};
    for (const pref of await db.exercisePrefs.toArray()) {
      modePrefs[pref.exerciseId] = pref.preferredInputMethod;
    }

    return {
      dayTemplateId,
      dayName: day.name,
      exercises,
      sessionId: open?.id ?? null,
      exerciseIds,
      logs,
      prefills,
      modePrefs,
      isRestDay: false,
      nextUp: null,
    };
  }, []);
}

const MODES: { id: InputMethod; label: string }[] = [
  { id: "barbell", label: "Barbell" },
  { id: "dumbbell", label: "Dumbbell" },
  { id: "manual", label: "Manual" },
];

export function Today() {
  const data = useTodayData();
  const [unit] = useUnit();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [restDuration, setRestDuration] = useState(DEFAULT_REST_SECONDS);
  const [timerRun, setTimerRun] = useState(0);
  const [timerVisible, setTimerVisible] = useState(false);
  const [addingExercise, setAddingExercise] = useState(false);

  // Input state for the active exercise, all in the current display unit.
  const [mode, setModeState] = useState<InputMethod>("manual");
  const [barWeight, setBarWeight] = useState(DEFAULT_BAR.lb);
  const [plates, setPlates] = useState<number[]>([]);
  const [dumbbell, setDumbbell] = useState(25);
  const [pair, setPair] = useState(true);
  const [manualWeight, setManualWeight] = useState(45);
  const [reps, setReps] = useState(8);

  const logsByExercise = useMemo(() => {
    const map = new Map<string, SetLog[]>();
    for (const log of data?.logs ?? []) {
      const list = map.get(log.exerciseId) ?? [];
      list.push(log);
      map.set(log.exerciseId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.setNumber - b.setNumber);
    }
    return map;
  }, [data?.logs]);

  const targetSetsFor = (exerciseId: string) =>
    data?.prefills[exerciseId]?.length || DEFAULT_TARGET_SETS;

  const derivedActiveId = useMemo(() => {
    if (!data) return null;
    const next = data.exercises.find(
      (e) => (logsByExercise.get(e.id)?.length ?? 0) < targetSetsFor(e.id),
    );
    return next?.id ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, logsByExercise]);

  const activeId = selectedId ?? derivedActiveId;
  const activeSetNumber = activeId
    ? (logsByExercise.get(activeId)?.length ?? 0) + 1
    : 1;

  /**
   * Set that seeds the prefill: last session's matching set number,
   * else last session's final set, else the set just logged today
   * (covers first-ever sessions past set 1).
   */
  const sourceSet: SetLog | undefined = useMemo(() => {
    if (!data || !activeId) return undefined;
    const prior = data.prefills[activeId] ?? [];
    const today = logsByExercise.get(activeId) ?? [];
    return (
      prior[activeSetNumber - 1] ??
      prior[prior.length - 1] ??
      today[today.length - 1]
    );
  }, [data, activeId, activeSetNumber, logsByExercise]);

  // Choose the input mode when the active exercise changes:
  // saved preference > last logged method > seeded/library default.
  useEffect(() => {
    if (!data || !activeId) return;
    const prior = data.prefills[activeId] ?? [];
    const lastMethod = prior[prior.length - 1]?.inputMethod;
    const hint = data.exercises.find((e) => e.id === activeId)?.inputMethodHint;
    setModeState(
      data.modePrefs[activeId] ??
        lastMethod ??
        defaultInputMethodFor(activeId, hint),
    );
    setPair(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, data === undefined]);

  // Prefill input values whenever exercise, set number, unit, or mode change.
  const prefillKey = `${data?.dayTemplateId}:${activeId}:${activeSetNumber}`;
  useEffect(() => {
    if (!data || !activeId || !data.dayTemplateId) return;
    const startLb = sourceSet?.weight ?? startWeightFor(activeId);
    const w = toDisplay(startLb, unit);
    setReps(sourceSet?.reps ?? defaultRepsFor(data.dayTemplateId));

    if (mode === "barbell") {
      const breakdown = sourceSet?.loadBreakdown;
      if (sourceSet?.inputMethod === "barbell" && breakdown?.platesPerSide) {
        // Reconstruct the exact stack that was loaded last time.
        const bar = breakdown.barWeight ?? toCanonical(DEFAULT_BAR[unit], unit);
        setBarWeight(toDisplay(bar, unit));
        setPlates(
          breakdown.platesPerSide
            .map((p) => toDisplay(p, unit))
            .sort((a, b) => b - a),
        );
      } else {
        setBarWeight(DEFAULT_BAR[unit]);
        setPlates(decomposePlates(w, DEFAULT_BAR[unit], unit));
      }
    } else if (mode === "dumbbell") {
      setDumbbell(nearestDumbbell(w, unit));
    } else {
      setManualWeight(w);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillKey, unit, mode, data === undefined]);

  if (!data) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  if (data.isRestDay) {
    return (
      <div>
        <header className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Rest day
            </h1>
            <p className="mt-1 text-sm text-muted">
              {new Date().toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <UnitToggle />
        </header>
        <p className="mb-4 text-sm leading-relaxed text-muted">
          No workout scheduled for today.
          {data.nextUp &&
            ` Next: ${data.nextUp.dayName} ${
              data.nextUp.daysAway === 1
                ? "tomorrow"
                : `in ${data.nextUp.daysAway} days`
            }.`}{" "}
          Adjust the rotation on the Split screen if this looks wrong.
        </p>
        {addingExercise ? (
          <ExerciseCombobox
            excludeIds={data.exerciseIds}
            onCancel={() => setAddingExercise(false)}
            onPick={async (entry) => {
              const id = await ensureExerciseRow(entry);
              await addAdHocExercise(id);
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAddingExercise(true)}
            className="text-[13px] font-medium text-muted transition-colors duration-150 hover:text-ink"
          >
            Add exercise
          </button>
        )}
      </div>
    );
  }

  const totalDisplay =
    mode === "barbell"
      ? round2(barWeight + 2 * plates.reduce((a, b) => a + b, 0))
      : mode === "dumbbell"
        ? dumbbell
        : manualWeight;

  const allDone =
    data.exercises.length > 0 &&
    data.exercises.every(
      (e) => (logsByExercise.get(e.id)?.length ?? 0) >= targetSetsFor(e.id),
    );
  const anyLogged = data.logs.length > 0;

  function setMode(next: InputMethod, exerciseId: string) {
    setModeState(next);
    void db.exercisePrefs.put({
      exerciseId,
      preferredInputMethod: next,
    });
  }

  async function ensureSession(): Promise<string> {
    if (data!.sessionId) return data!.sessionId;
    const dayTemplateId = data!.dayTemplateId ?? REST_DAY_TEMPLATE.id;
    const id = newId();
    await db.sessions.add({
      id,
      date: new Date().toISOString(),
      dayTemplateId,
      completed: false,
      extraExerciseIds: [],
    });
    return id;
  }

  async function logSet(
    exerciseId: string,
    weightLb: number,
    repsToLog: number,
    inputMethod: InputMethod,
    loadBreakdown?: LoadBreakdown,
  ) {
    const sessionId = await ensureSession();
    const setNumber = (logsByExercise.get(exerciseId)?.length ?? 0) + 1;
    await db.setLogs.add({
      id: newId(),
      sessionId,
      exerciseId,
      setNumber,
      weight: weightLb,
      reps: repsToLog,
      inputMethod,
      loadBreakdown,
    });
    // Stay on this exercise until its sets are done, then fall back to
    // the enforced order (first incomplete exercise).
    setSelectedId(setNumber >= targetSetsFor(exerciseId) ? null : exerciseId);
    setTimerRun((n) => n + 1);
    setTimerVisible(true);
  }

  async function logCurrent(exerciseId: string) {
    const breakdown: LoadBreakdown | undefined =
      mode === "barbell"
        ? {
            barWeight: toCanonical(barWeight, unit),
            platesPerSide: plates.map((p) => toCanonical(p, unit)),
          }
        : undefined;
    await logSet(
      exerciseId,
      toCanonical(totalDisplay, unit),
      reps,
      mode,
      breakdown,
    );
  }

  async function logSameAsLastTime(exerciseId: string) {
    if (!sourceSet) return;
    // Replays the exact prior load: canonical weight, method, plate stack.
    await logSet(
      exerciseId,
      sourceSet.weight,
      sourceSet.reps,
      sourceSet.inputMethod ?? mode,
      sourceSet.loadBreakdown,
    );
  }

  async function finishWorkout() {
    if (!data!.sessionId) return;
    await db.sessions.update(data!.sessionId, { completed: true });
    setSelectedId(null);
    setTimerVisible(false);
    setAddingExercise(false);
  }

  async function addAdHocExercise(exerciseId: string) {
    const sessionId = await ensureSession();
    const session = await db.sessions.get(sessionId);
    if (!session) return;
    const extra = session.extraExerciseIds ?? [];
    if (extra.includes(exerciseId) || data!.exerciseIds.includes(exerciseId)) {
      setAddingExercise(false);
      setSelectedId(exerciseId);
      return;
    }
    await db.sessions.update(sessionId, {
      extraExerciseIds: [...extra, exerciseId],
    });
    setAddingExercise(false);
    setSelectedId(exerciseId);
  }

  return (
    <div>
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {data.dayName}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
            {anyLogged &&
              ` · ${data.logs.length} ${data.logs.length === 1 ? "set" : "sets"} logged`}
          </p>
        </div>
        <UnitToggle />
      </header>

      <ul className="space-y-3">
        {data.exercises.map((exercise) => {
          const logged = logsByExercise.get(exercise.id) ?? [];
          const target = targetSetsFor(exercise.id);
          const isActive = exercise.id === activeId;
          const complete = logged.length >= target;
          const prior = data.prefills[exercise.id] ?? [];
          const lastSummary = prior.length
            ? `Last: ${prior
                .map((s) => `${formatWeight(toDisplay(s.weight, unit))}×${s.reps}`)
                .join("  ")}`
            : "First time — starting defaults ready";

          return (
            <li
              key={exercise.id}
              className="rounded-md border border-hairline bg-surface"
            >
              <button
                type="button"
                onClick={() =>
                  setSelectedId(isActive && selectedId ? null : exercise.id)
                }
                className="flex w-full items-baseline justify-between gap-3 px-4 py-3.5 text-left"
                aria-expanded={isActive}
              >
                <span>
                  <span className="block text-[17px] font-semibold tracking-tight">
                    {exercise.name}
                  </span>
                  <span className="tnum mt-0.5 block text-[13px] text-muted">
                    {lastSummary}
                  </span>
                </span>
                <span className="tnum shrink-0 text-[13px] font-medium text-muted">
                  {complete ? "Done" : `${logged.length} of ${target}`}
                </span>
              </button>

              {logged.length > 0 && (
                <div className="tnum flex flex-wrap gap-x-4 gap-y-1 border-t border-hairline px-4 py-2.5 text-sm text-muted">
                  {logged.map((s) => (
                    <span key={s.id} className="text-ink">
                      {formatWeight(toDisplay(s.weight, unit))}×{s.reps}
                    </span>
                  ))}
                </div>
              )}

              {isActive && (
                <div className="border-t border-hairline px-4 py-4">
                  {/* Input mode: remembered per exercise */}
                  <div className="mb-4 flex justify-center">
                    <div
                      role="group"
                      aria-label="Weight input method"
                      className="flex overflow-hidden rounded-md border border-hairline bg-surface"
                    >
                      {MODES.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          aria-pressed={mode === m.id}
                          onClick={() => setMode(m.id, exercise.id)}
                          className={[
                            "h-10 px-4 text-[13px] font-medium transition-colors duration-150",
                            mode === m.id
                              ? "bg-surface-raised text-ink"
                              : "text-muted hover:text-ink",
                          ].join(" ")}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* The number that gets logged, always visible and large */}
                  <div className="mb-4 text-center">
                    <span className="tnum text-3xl font-semibold tracking-tight">
                      {formatWeight(totalDisplay)}
                    </span>
                    <span className="ml-1.5 text-sm text-muted">{unit}</span>
                    {mode === "barbell" && (
                      <p className="tnum mt-0.5 text-[13px] text-muted">
                        {formatWeight(barWeight)} bar
                        {plates.length > 0 &&
                          ` + 2 × ${formatWeight(round2(plates.reduce((a, b) => a + b, 0)))}`}
                      </p>
                    )}
                    {mode === "dumbbell" && (
                      <p className="mt-0.5 text-[13px] text-muted">
                        {pair ? "per hand, pair" : "single arm"}
                      </p>
                    )}
                  </div>

                  {mode === "barbell" && (
                    <BarbellPicker
                      key={`${exercise.id}:${unit}`}
                      unit={unit}
                      barWeight={barWeight}
                      plates={plates}
                      onChange={(bar, next) => {
                        setBarWeight(bar);
                        setPlates(next);
                      }}
                    />
                  )}
                  {mode === "dumbbell" && (
                    <DumbbellPicker
                      unit={unit}
                      value={dumbbell}
                      pair={pair}
                      onChange={setDumbbell}
                      onPairChange={setPair}
                    />
                  )}
                  {mode === "manual" && (
                    <div className="flex justify-center">
                      <Stepper
                        label={`Weight (${unit})`}
                        value={manualWeight}
                        step={MANUAL_STEP[unit]}
                        onChange={setManualWeight}
                      />
                    </div>
                  )}

                  <div className="mt-4 flex justify-center">
                    <Stepper
                      label="Reps"
                      value={reps}
                      step={1}
                      min={1}
                      onChange={setReps}
                    />
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => logCurrent(exercise.id)}
                      className="h-12 flex-1 rounded-md bg-accent text-[15px] font-semibold text-bg transition-colors duration-150 hover:bg-ink"
                    >
                      Log set {logged.length + 1}
                    </button>
                    {prior.length > 0 && !complete && (
                      <button
                        type="button"
                        onClick={() => logSameAsLastTime(exercise.id)}
                        className="h-12 rounded-md border border-hairline bg-surface px-4 text-[15px] font-medium text-ink transition-colors duration-150 hover:bg-surface-raised"
                      >
                        Same as last time
                      </button>
                    )}
                  </div>
                  <Link
                    to={`/exercise/${exercise.id}`}
                    className="mt-3 inline-block text-[13px] font-medium text-muted transition-colors duration-150 hover:text-ink"
                  >
                    View history
                  </Link>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {!data.isRestDay && (
        <div className="mt-4">
          {addingExercise ? (
            <ExerciseCombobox
              excludeIds={data.exerciseIds}
              onCancel={() => setAddingExercise(false)}
              onPick={async (entry) => {
                const id = await ensureExerciseRow(entry);
                await addAdHocExercise(id);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAddingExercise(true)}
              className="text-[13px] font-medium text-muted transition-colors duration-150 hover:text-ink"
            >
              Add exercise
            </button>
          )}
        </div>
      )}

      {anyLogged && (
        <div className="mt-6">
          <button
            type="button"
            onClick={finishWorkout}
            className={
              allDone
                ? "h-12 w-full rounded-md bg-accent text-[15px] font-semibold text-bg transition-colors duration-150 hover:bg-ink"
                : "h-12 w-full rounded-md border border-hairline bg-surface text-[15px] font-medium text-ink transition-colors duration-150 hover:bg-surface-raised"
            }
          >
            Finish workout
          </button>
        </div>
      )}

      {/* Keep the floating timer from covering the last controls. */}
      {timerVisible && <div aria-hidden="true" className="h-24" />}

      {timerVisible && (
        <RestTimer
          runId={timerRun}
          duration={restDuration}
          onAdjustDuration={setRestDuration}
          onDismiss={() => setTimerVisible(false)}
        />
      )}
    </div>
  );
}
