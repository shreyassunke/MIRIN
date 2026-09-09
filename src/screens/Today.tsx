import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  db,
  type Exercise,
  type LoadBreakdown,
  type SetDrop,
  type SetLog,
} from "../db/db";
import {
  DEFAULT_REST_SECONDS,
  defaultInputMethodFor,
  defaultRepsFor,
  formatSet,
  formatWeight,
  lastSets,
  newId,
  planFillFromLastTime,
  startWeightFor,
} from "../lib/workout";
import {
  dayTemplateIdForDate,
  nextWorkout,
  toLocalISODate,
} from "../lib/rotation";
import { REST_DAY_TEMPLATE } from "../db/seed";
import { ensureExerciseRow, type ExerciseLibraryEntry } from "../lib/library";
import {
  appendSessionExercise,
  reorderSessionExercises,
  resolveSessionExerciseIds,
  setExerciseFinished,
  swapSessionExercise,
} from "../lib/session";
import { ExerciseCombobox } from "../components/ExerciseCombobox";
import { TodayExerciseTile } from "../components/TodayExerciseTile";
import { useDragReorder } from "../hooks/useDragReorder";
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
  /** Exercises the user called done; sets per exercise are otherwise unfixed. */
  finishedExerciseIds: string[];
  isRestDay: boolean;
  nextUp: { dayName: string; daysAway: number } | null;
}

function orderedExercises(
  exerciseIds: string[],
  rows: (Exercise | undefined)[],
): Exercise[] {
  const byId = new Map(
    rows
      .filter((e): e is Exercise => e !== undefined)
      .map((e) => [e.id, e] as const),
  );
  return exerciseIds
    .map((id) => byId.get(id))
    .filter((e): e is Exercise => e !== undefined);
}

function useTodayData(): TodayData | undefined {
  return useLiveQuery(async () => {
    // The active split drives today; a lone split acts as active.
    const split =
      (await db.splits.filter((s) => s.isActive).first()) ??
      (await db.splits.toCollection().first());
    if (!split) return undefined;

    const today = new Date();
    const todayIso = toLocalISODate(today);
    const allDays = new Map(
      (await db.dayTemplates.toArray()).map((d) => [d.id, d] as const),
    );
    const isRest = (id: string) =>
      (allDays.get(id)?.isRestDay ?? false) ||
      (allDays.get(id)?.exerciseIds.length ?? 0) === 0;

    // Active split schedule always owns what Today shows.
    const scheduledId = dayTemplateIdForDate(split, today);
    const dayTemplateId =
      scheduledId && allDays.get(scheduledId) ? scheduledId : null;
    const day = dayTemplateId ? allDays.get(dayTemplateId) : undefined;

    // Resume only today's open session for the scheduled day — never a
    // leftover incomplete session from another calendar day or template.
    const sessions = await db.sessions.toArray();
    const open = sessions
      .filter(
        (s) =>
          !s.completed &&
          toLocalISODate(new Date(s.date)) === todayIso &&
          s.dayTemplateId === dayTemplateId,
      )
      .sort((a, b) => b.date.localeCompare(a.date))[0];

    if (!day || day.isRestDay) {
      const upcoming = nextWorkout(split, isRest, today, 1);
      const exerciseIds = resolveSessionExerciseIds(undefined, open);
      const exercises = orderedExercises(
        exerciseIds,
        await db.exercises.bulkGet(exerciseIds),
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
        dayTemplateId: null,
        dayName: exerciseIds.length > 0 ? "Extra work" : "Rest day",
        exercises,
        sessionId: open?.id ?? null,
        exerciseIds,
        logs,
        prefills,
        modePrefs,
        finishedExerciseIds: open?.finishedExerciseIds ?? [],
        isRestDay: !open && exerciseIds.length === 0,
        nextUp: upcoming
          ? {
              dayName: allDays.get(upcoming.dayTemplateId)?.name ?? "",
              daysAway: upcoming.daysAway,
            }
          : null,
      };
    }

    const exerciseIds = resolveSessionExerciseIds(day, open);
    const exercises = orderedExercises(
      exerciseIds,
      await db.exercises.bulkGet(exerciseIds),
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
      finishedExerciseIds: open?.finishedExerciseIds ?? [],
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
  /** When false, derived auto-expand is paused (user closed the open card). */
  const [followDerived, setFollowDerived] = useState(true);
  const [restDuration, setRestDuration] = useState(DEFAULT_REST_SECONDS);
  const [timerRun, setTimerRun] = useState(0);
  const [timerVisible, setTimerVisible] = useState(false);
  const [addingExercise, setAddingExercise] = useState(false);
  const [swappingIndex, setSwappingIndex] = useState<number | null>(null);
  /** Completing fills sets from last session, so it takes a second tap. */
  const [finishArmed, setFinishArmed] = useState(false);

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

  const ensureSession = useCallback(async (): Promise<string> => {
    if (data?.sessionId) return data.sessionId;
    const dayTemplateId = data?.dayTemplateId ?? REST_DAY_TEMPLATE.id;
    const id = newId();
    await db.sessions.add({
      id,
      date: new Date().toISOString(),
      dayTemplateId,
      completed: false,
      extraExerciseIds: [],
    });
    return id;
  }, [data?.dayTemplateId, data?.sessionId]);

  const { getItemProps, shouldSuppressClick } = useDragReorder({
    enabled: (data?.exercises.length ?? 0) > 1,
    handleOnly: false,
    onReorder: (from, to) => {
      void (async () => {
        const sessionId = await ensureSession();
        await reorderSessionExercises(sessionId, from, to);
      })();
    },
  });

  const finishedIds = useMemo(
    () => new Set(data?.finishedExerciseIds ?? []),
    [data?.finishedExerciseIds],
  );

  /** First exercise the user has not called done. Set counts are unfixed. */
  const derivedActiveId = useMemo(() => {
    if (!data) return null;
    const next = data.exercises.find((e) => !finishedIds.has(e.id));
    return next?.id ?? null;
  }, [data, finishedIds]);

  /** What "Complete all exercises" would write, recomputed as sets land. */
  const fillPlan = useMemo(
    () =>
      data
        ? planFillFromLastTime(
            data.exercises,
            data.prefills,
            logsByExercise,
            finishedIds,
          )
        : [],
    [data, logsByExercise, finishedIds],
  );

  const activeId = followDerived
    ? (selectedId ?? derivedActiveId)
    : selectedId;
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

  // Never leave the fill-and-complete confirmation armed behind the user.
  useEffect(() => {
    if (!finishArmed) return;
    const timeout = setTimeout(() => setFinishArmed(false), 5000);
    return () => clearTimeout(timeout);
  }, [finishArmed]);

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

  const anyLogged = data.logs.length > 0;
  const fillExerciseCount = new Set(fillPlan.map((p) => p.exerciseId)).size;

  function setMode(next: InputMethod, exerciseId: string) {
    setModeState(next);
    void db.exercisePrefs.put({
      exerciseId,
      preferredInputMethod: next,
    });
  }

  async function logSet(
    exerciseId: string,
    weightLb: number,
    repsToLog: number,
    inputMethod: InputMethod,
    loadBreakdown?: LoadBreakdown,
  ) {
    const sessionId = await ensureSession();
    const session = await db.sessions.get(sessionId);
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
      swappedFromExerciseId: session?.exerciseSwapOrigins?.[exerciseId],
    });
    // A logged set reopens an exercise that was called done.
    if (finishedIds.has(exerciseId)) {
      await setExerciseFinished(sessionId, exerciseId, false);
    }
    // Set counts are unfixed, so nothing advances on its own: stay here
    // until the user says this exercise is done.
    setFollowDerived(true);
    setSelectedId(exerciseId);
    setTimerRun((n) => n + 1);
    setTimerVisible(true);
  }

  /**
   * Append the current weight and reps as a drop on the exercise's last set.
   * Drops are taken without rest, so the timer only starts once logged.
   */
  async function logDrop(exerciseId: string) {
    const logged = logsByExercise.get(exerciseId) ?? [];
    const parent = logged[logged.length - 1];
    if (!parent) return;
    const drop: SetDrop = {
      weight: toCanonical(totalDisplay, unit),
      reps,
      loadBreakdown:
        mode === "barbell"
          ? {
              barWeight: toCanonical(barWeight, unit),
              platesPerSide: plates.map((p) => toCanonical(p, unit)),
            }
          : undefined,
    };
    await db.setLogs.update(parent.id, {
      drops: [...(parent.drops ?? []), drop],
    });
    setFollowDerived(true);
    setSelectedId(exerciseId);
    setTimerRun((n) => n + 1);
    setTimerVisible(true);
  }

  async function toggleExerciseFinished(exerciseId: string, finished: boolean) {
    const sessionId = await ensureSession();
    await setExerciseFinished(sessionId, exerciseId, finished);
    setFollowDerived(true);
    setSelectedId(null);
    if (finished) setTimerVisible(false);
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

  /**
   * Fill every set still missing against last session, then close the session.
   * Available at any point in the workout, including before the first set.
   */
  async function finishWorkout() {
    const sessionId = await ensureSession();
    const session = await db.sessions.get(sessionId);
    if (fillPlan.length > 0) {
      await db.setLogs.bulkAdd(
        fillPlan.map((planned) => ({
          id: newId(),
          sessionId,
          exerciseId: planned.exerciseId,
          setNumber: planned.setNumber,
          weight: planned.weight,
          reps: planned.reps,
          inputMethod: planned.inputMethod,
          loadBreakdown: planned.loadBreakdown,
          drops: planned.drops,
          swappedFromExerciseId:
            session?.exerciseSwapOrigins?.[planned.exerciseId],
        })),
      );
    }
    await db.sessions.update(sessionId, {
      completed: true,
      finishedExerciseIds: data!.exercises.map((e) => e.id),
    });
    setFinishArmed(false);
    setFollowDerived(true);
    setSelectedId(null);
    setTimerVisible(false);
    setAddingExercise(false);
    setSwappingIndex(null);
  }

  async function addAdHocExercise(exerciseId: string) {
    const sessionId = await ensureSession();
    if (data!.exerciseIds.includes(exerciseId)) {
      setAddingExercise(false);
      setFollowDerived(true);
      setSelectedId(exerciseId);
      return;
    }
    await appendSessionExercise(sessionId, exerciseId);
    setAddingExercise(false);
    setFollowDerived(true);
    setSelectedId(exerciseId);
  }

  async function handleSwapExercise(index: number, entry: ExerciseLibraryEntry) {
    const newExerciseId = await ensureExerciseRow(entry);
    const sessionId = await ensureSession();
    const outgoingId = await swapSessionExercise(sessionId, index, newExerciseId);
    setSwappingIndex(null);
    setFollowDerived(true);
    if (
      selectedId === outgoingId ||
      (selectedId === null && activeId === outgoingId)
    ) {
      setSelectedId(newExerciseId);
    }
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
        {data.exercises.map((exercise, index) => {
          const logged = logsByExercise.get(exercise.id) ?? [];
          const isActive = exercise.id === activeId;
          const finished = finishedIds.has(exercise.id);
          const prior = data.prefills[exercise.id] ?? [];
          const lastSummary = prior.length
            ? `Last: ${prior
                .map((s) => formatSet(s, (lb) => toDisplay(lb, unit)))
                // Explicit separator: a drop chain already reads as one set.
                .join(" · ")}`
            : "First time — starting defaults ready";
          const dragProps = getItemProps(index);

          return (
            <TodayExerciseTile
              key={exercise.id}
              exercise={exercise}
              logged={logged}
              isActive={isActive}
              finished={finished}
              lastSummary={lastSummary}
              isSwapping={swappingIndex === index}
              excludeSwapIds={data.exerciseIds.filter((id) => id !== exercise.id)}
              reorderIndex={index}
              dragRowClassName={dragProps.className}
              dragStyle={dragProps.style}
              onDragPointerDown={dragProps.onPointerDown}
              onDragPointerMove={dragProps.onPointerMove}
              onDragPointerUp={dragProps.onPointerUp}
              onDragPointerCancel={dragProps.onPointerCancel}
              shouldSuppressClick={shouldSuppressClick}
              onToggle={() => {
                if (shouldSuppressClick()) return;
                if (swappingIndex === index) {
                  setSwappingIndex(null);
                  return;
                }
                if (isActive) {
                  setFollowDerived(false);
                  setSelectedId(null);
                  setSwappingIndex(null);
                  return;
                }
                setFollowDerived(true);
                setSelectedId(exercise.id);
                setSwappingIndex(null);
              }}
              onStartSwap={() => {
                if (shouldSuppressClick()) return;
                setFollowDerived(true);
                setSelectedId(exercise.id);
                setSwappingIndex(index);
              }}
              onCancelSwap={() => setSwappingIndex(null)}
              onSwapPick={(entry) => void handleSwapExercise(index, entry)}
              formatLoggedSet={(s) => formatSet(s, (lb) => toDisplay(lb, unit))}
            >
              {isActive && (
                <div className="border-t border-hairline px-4 py-4">
                  {/* Input mode: remembered per exercise */}
                  <div className="mb-4 flex justify-center">
                    <div
                      role="group"
                      aria-label="Weight input method"
                      className="glass flex overflow-hidden rounded-pill p-0.5"
                    >
                      {MODES.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          aria-pressed={mode === m.id}
                          onClick={() => setMode(m.id, exercise.id)}
                          className={[
                            "glass-chip h-10 rounded-pill px-4 text-[13px] font-medium",
                            mode === m.id
                              ? "glass-chip-active text-ink"
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
                      className="btn-primary h-12 flex-1 rounded-pill bg-accent text-[15px] font-semibold text-bg hover:bg-ink"
                    >
                      Log set {logged.length + 1}
                    </button>
                    {prior.length > 0 && (
                      <button
                        type="button"
                        onClick={() => logSameAsLastTime(exercise.id)}
                        className="glass-btn h-12 rounded-pill px-4 text-[15px] font-medium text-ink"
                      >
                        Same as last time
                      </button>
                    )}
                  </div>

                  {logged.length > 0 && (
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void logDrop(exercise.id)}
                        aria-label={`Add a drop to set ${logged.length} of ${exercise.name}`}
                        className="glass-btn h-12 flex-1 rounded-pill text-[15px] font-medium text-ink"
                      >
                        Add drop to set {logged.length}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void toggleExerciseFinished(exercise.id, true)
                        }
                        aria-label={`Mark ${exercise.name} done`}
                        className="glass-btn h-12 rounded-pill px-5 text-[15px] font-medium text-ink"
                      >
                        Done
                      </button>
                    </div>
                  )}
                  <Link
                    to={`/exercise/${exercise.id}`}
                    className="mt-3 inline-block text-[13px] font-medium text-muted transition-colors duration-150 hover:text-ink"
                  >
                    View history
                  </Link>
                </div>
              )}
            </TodayExerciseTile>
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

      {data.exercises.length > 0 && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() =>
              finishArmed ? void finishWorkout() : setFinishArmed(true)
            }
            className={[
              "h-12 w-full rounded-pill text-[15px] font-semibold",
              // The One Accent Rule: an open exercise owns the accent for its
              // log button, so this takes it only once nothing is logging.
              activeId === null
                ? "btn-primary bg-accent text-bg hover:bg-ink"
                : "glass-btn text-ink",
            ].join(" ")}
          >
            {finishArmed ? "Confirm" : "Complete all exercises"}
          </button>
          <p className="mt-2 text-center text-[13px] text-muted">
            {fillPlan.length > 0
              ? `${finishArmed ? "Logs" : "Fills"} ${fillPlan.length} ${
                  fillPlan.length === 1 ? "set" : "sets"
                } from last session across ${fillExerciseCount} ${
                  fillExerciseCount === 1 ? "exercise" : "exercises"
                }, then completes.`
              : anyLogged
                ? `Completes the workout with ${data.logs.length} ${
                    data.logs.length === 1 ? "set" : "sets"
                  } logged.`
                : "Nothing recorded to fill from. Completes an empty session."}
          </p>
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
