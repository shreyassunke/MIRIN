import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { dayTemplateIdForDate, nextWorkout, toLocalISODate } from "../lib/rotation";
import { REST_DAY_TEMPLATE } from "../db/seed";
import {
  applyTodaySwitch,
  resolvedTodayTemplateId,
  uniqueDayOptions,
  type DaySwitchOption,
  type TodaySwitchMode,
} from "../lib/splits";
import {
  attachmentForEquipment,
  ensureExerciseRow,
  equipmentForExercise,
  inputModesForEquipment,
  resolveInputMethod,
  type ExerciseLibraryEntry,
} from "../lib/library";
import {
  convertLoadForLaterality,
  defaultLaterality,
  loadSharing,
  supportsLaterality,
  type Laterality,
} from "../lib/laterality";
import {
  appendSessionExercise,
  removeSessionExercise,
  reorderSessionExercises,
  resolveSessionExerciseIds,
  resolveSessionSupersets,
  resolveSessionWarmupTargets,
  setExerciseFinished,
  setSessionNote,
  setSessionWarmupTarget,
  swapSessionExercise,
  toggleSessionSuperset,
} from "../lib/session";
import {
  DEFAULT_WARMUP_COUNT,
  formatRest,
  groupPosFor,
  inSuperset,
  orderedGroup,
  patchExercisePref,
  warmupDisplayWeight,
  workingSets,
} from "../lib/exerciseMeta";
import { deleteSetDrop, deleteSetLog } from "../lib/history";
import { ExerciseCombobox } from "../components/ExerciseCombobox";
import { TodayExerciseTile } from "../components/TodayExerciseTile";
import { NoteEditor } from "../components/NoteEditor";
import { FormVideoPanel } from "../components/FormVideo";
import { formClipsFor } from "../lib/formVideos";
import {
  IconDone,
  IconHistory,
  IconNote,
  IconRemove,
  IconReplace,
  IconRest,
  IconSticky,
  IconSuperset,
  IconVideo,
  IconWarmup,
  ItemOverflow,
  RestPresetPanel,
} from "../components/ItemOverflow";
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
import { DaySwitcher } from "../components/DaySwitcher";
import { LateralityToggle } from "../components/LateralityToggle";
import {
  BarbellPicker,
  BarbellRack,
  BarWeightControl,
} from "../components/weight/BarbellPicker";
import { DumbbellPicker } from "../components/weight/DumbbellPicker";
import { LoadInstrument } from "../components/weight/LoadInstrument";

interface TodayData {
  splitId: string;
  dayTemplateId: string | null;
  currentTemplateId: string | null;
  scheduledTemplateId: string | null;
  switchOptions: DaySwitchOption[];
  dayName: string;
  exercises: Exercise[];
  sessionId: string | null;
  /** Ids already on today's list (scheduled + ad-hoc). */
  exerciseIds: string[];
  logs: SetLog[];
  prefills: Record<string, SetLog[]>;
  modePrefs: Record<string, InputMethod>;
  lateralityPrefs: Record<string, Laterality>;
  stickyNotes: Record<string, string>;
  restSeconds: Record<string, number>;
  exerciseNotes: Record<string, string>;
  supersets: string[][];
  warmupTargets: Record<string, number>;
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

    // Active split schedule owns the default; a same-day override can
    // stand in when the user switched sessions for today.
    const scheduledId = dayTemplateIdForDate(split, today);
    const resolvedId = resolvedTodayTemplateId(split, allDays, today);
    const dayTemplateId =
      resolvedId && allDays.get(resolvedId) ? resolvedId : null;
    const day = dayTemplateId ? allDays.get(dayTemplateId) : undefined;
    const switchOptions = uniqueDayOptions(split, allDays);

    // Resume only today's open session for the resolved day — never a
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
        prefills[exercise.id] = (await lastSets(exercise.id, open?.id)).filter(
          (s) => !s.isWarmup,
        );
      }
      const modePrefs: Record<string, InputMethod> = {};
      const lateralityPrefs: Record<string, Laterality> = {};
      const stickyNotes: Record<string, string> = {};
      const restSeconds: Record<string, number> = {};
      for (const pref of await db.exercisePrefs.toArray()) {
        if (pref.preferredInputMethod) {
          modePrefs[pref.exerciseId] = pref.preferredInputMethod;
        }
        if (pref.preferredLaterality) {
          lateralityPrefs[pref.exerciseId] = pref.preferredLaterality;
        }
        if (pref.stickyNote) stickyNotes[pref.exerciseId] = pref.stickyNote;
        if (pref.restSeconds) restSeconds[pref.exerciseId] = pref.restSeconds;
      }
      return {
        splitId: split.id,
        dayTemplateId: null,
        currentTemplateId: day?.id ?? REST_DAY_TEMPLATE.id,
        scheduledTemplateId: scheduledId,
        switchOptions,
        dayName: exerciseIds.length > 0 ? "Extra work" : "Rest day",
        exercises,
        sessionId: open?.id ?? null,
        exerciseIds,
        logs,
        prefills,
        modePrefs,
        lateralityPrefs,
        stickyNotes,
        restSeconds,
        exerciseNotes: open?.exerciseNotes ?? {},
        supersets: resolveSessionSupersets(undefined, open),
        warmupTargets: resolveSessionWarmupTargets(undefined, open),
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
      prefills[exercise.id] = (await lastSets(exercise.id, open?.id)).filter(
        (s) => !s.isWarmup,
      );
    }

    const modePrefs: Record<string, InputMethod> = {};
    const lateralityPrefs: Record<string, Laterality> = {};
    const stickyNotes: Record<string, string> = {};
    const restSeconds: Record<string, number> = {};
    for (const pref of await db.exercisePrefs.toArray()) {
      if (pref.preferredInputMethod) {
        modePrefs[pref.exerciseId] = pref.preferredInputMethod;
      }
      if (pref.preferredLaterality) {
        lateralityPrefs[pref.exerciseId] = pref.preferredLaterality;
      }
      if (pref.stickyNote) stickyNotes[pref.exerciseId] = pref.stickyNote;
      if (pref.restSeconds) restSeconds[pref.exerciseId] = pref.restSeconds;
    }

    return {
      splitId: split.id,
      dayTemplateId,
      currentTemplateId: dayTemplateId,
      scheduledTemplateId: scheduledId,
      switchOptions,
      dayName: day.name,
      exercises,
      sessionId: open?.id ?? null,
      exerciseIds,
      logs,
      prefills,
      modePrefs,
      lateralityPrefs,
      stickyNotes,
      restSeconds,
      exerciseNotes: open?.exerciseNotes ?? {},
      supersets: resolveSessionSupersets(day, open),
      warmupTargets: resolveSessionWarmupTargets(day, open),
      finishedExerciseIds: open?.finishedExerciseIds ?? [],
      isRestDay: false,
      nextUp: null,
    };
  }, []);
}

export function Today() {
  const data = useTodayData();
  const navigate = useNavigate();
  const [unit] = useUnit();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** When false, derived auto-expand is paused (user closed the open card). */
  const [followDerived, setFollowDerived] = useState(true);
  const [restDuration, setRestDuration] = useState(DEFAULT_REST_SECONDS);
  const [timerRun, setTimerRun] = useState(0);
  const [timerVisible, setTimerVisible] = useState(false);
  const [addingExercise, setAddingExercise] = useState(false);
  const [swappingIndex, setSwappingIndex] = useState<number | null>(null);
  const [timerExerciseId, setTimerExerciseId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<{
    id: string;
    kind: "session" | "sticky";
  } | null>(null);
  const [formVideoId, setFormVideoId] = useState<string | null>(null);
  const loggingRef = useRef(false);
  /** Completing fills sets from last session, so it takes a second tap. */
  const [finishArmed, setFinishArmed] = useState(false);

  // Input state for the active exercise, all in the current display unit.
  const [mode, setModeState] = useState<InputMethod>("manual");
  const [barWeight, setBarWeight] = useState(DEFAULT_BAR.lb);
  const [plates, setPlates] = useState<number[]>([]);
  const [dumbbell, setDumbbell] = useState(25);
  const [laterality, setLaterality] = useState<Laterality>("bilateral");
  const lateralityRef = useRef<Laterality>("bilateral");
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
    const day =
      data?.dayTemplateId != null
        ? await db.dayTemplates.get(data.dayTemplateId)
        : undefined;
    const id = newId();
    await db.sessions.add({
      id,
      date: new Date().toISOString(),
      dayTemplateId,
      completed: false,
      extraExerciseIds: [],
      supersets: day?.supersets,
      warmupTargets: day?.warmupTargets,
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
  const activeLogs = activeId ? (logsByExercise.get(activeId) ?? []) : [];
  const activeWorkingCount = workingSets(activeLogs).length;
  const activeWarmupCount = activeLogs.filter((s) => s.isWarmup).length;
  const activeWarmupTarget = activeId
    ? (data?.warmupTargets[activeId] ?? 0)
    : 0;
  const loggingWarmup =
    Boolean(activeId) && activeWarmupCount < activeWarmupTarget;

  /**
   * Set that seeds the prefill: last session's matching working set,
   * else last session's final working set, else the set just logged today.
   */
  const sourceSet: SetLog | undefined = useMemo(() => {
    if (!data || !activeId) return undefined;
    const prior = data.prefills[activeId] ?? [];
    const todayWorking = workingSets(logsByExercise.get(activeId) ?? []);
    return (
      prior[activeWorkingCount] ??
      prior[prior.length - 1] ??
      todayWorking[todayWorking.length - 1]
    );
  }, [data, activeId, activeWorkingCount, logsByExercise]);

  // Choose the input mode when the active exercise changes:
  // saved preference > last logged method > seeded/library default,
  // then clamped to the attachment type's allowed buttons.
  useEffect(() => {
    if (!data || !activeId) return;
    const exercise = data.exercises.find((e) => e.id === activeId);
    const equipment = exercise
      ? equipmentForExercise(exercise)
      : "other";
    const prior = data.prefills[activeId] ?? [];
    const lastMethod = prior[prior.length - 1]?.inputMethod;
    const hint = exercise?.inputMethodHint;
    setModeState(
      resolveInputMethod(
        equipment,
        data.modePrefs[activeId] ??
          lastMethod ??
          defaultInputMethodFor(activeId, hint),
      ),
    );
    const nextLaterality =
      prior[prior.length - 1]?.laterality ??
      data.lateralityPrefs[activeId] ??
      defaultLaterality(exercise?.name ?? "");
    lateralityRef.current = nextLaterality;
    setLaterality(nextLaterality);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, data === undefined]);

  // Prefill input values whenever exercise, set number, unit, or mode change.
  const prefillKey = `${data?.dayTemplateId}:${activeId}:${activeWorkingCount}:${activeWarmupCount}:${loggingWarmup}`;
  useEffect(() => {
    if (!data || !activeId || !data.dayTemplateId) return;
    const exercise = data.exercises.find((e) => e.id === activeId);
    const equipment = exercise ? equipmentForExercise(exercise) : "other";
    const workingLb =
      sourceSet?.weight ??
      (attachmentForEquipment(equipment) === "bodyweight"
        ? 0
        : startWeightFor(activeId));
    const rawDisplay = loggingWarmup
      ? warmupDisplayWeight(workingLb, activeWarmupCount, unit)
      : toDisplay(workingLb, unit);
    const w = sourceSet
      ? convertLoadForLaterality(
          rawDisplay,
          sourceSet.laterality ?? "bilateral",
          lateralityRef.current,
          loadSharing(mode, equipment),
          unit,
        )
      : rawDisplay;
    setReps(
      loggingWarmup
        ? Math.max(5, (sourceSet?.reps ?? defaultRepsFor(data.dayTemplateId)) - activeWarmupCount)
        : (sourceSet?.reps ?? defaultRepsFor(data.dayTemplateId)),
    );

    if (mode === "barbell") {
      const breakdown = !loggingWarmup ? sourceSet?.loadBreakdown : undefined;
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

  const handleDaySwitch = useCallback(
    (id: string, mode: TodaySwitchMode) => {
      if (!data) return;
      void applyTodaySwitch(data.splitId, id, mode);
      setFollowDerived(true);
      setSelectedId(null);
      setFinishArmed(false);
      setTimerVisible(false);
      setAddingExercise(false);
      setSwappingIndex(null);
      setEditingNote(null);
      setFormVideoId(null);
    },
    [data],
  );

  if (!data) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  if (data.isRestDay) {
    return (
      <div>
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="shrink-0 pr-2">
            <DaySwitcher
              dayName={data.dayName}
              currentId={data.currentTemplateId}
              scheduledId={data.scheduledTemplateId}
              options={data.switchOptions}
              onSwitch={handleDaySwitch}
            />
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

  const activeExercise = data.exercises.find((e) => e.id === activeId);
  const inputMode = activeExercise
    ? resolveInputMethod(equipmentForExercise(activeExercise), mode)
    : mode;

  const totalDisplay =
    inputMode === "barbell"
      ? round2(barWeight + 2 * plates.reduce((a, b) => a + b, 0))
      : inputMode === "dumbbell"
        ? dumbbell
        : manualWeight;

  const anyLogged = data.logs.length > 0;
  const fillExerciseCount = new Set(fillPlan.map((p) => p.exerciseId)).size;

  function setMode(next: InputMethod, exerciseId: string) {
    setModeState(next);
    void patchExercisePref(exerciseId, { preferredInputMethod: next });
  }

  function setLateralityFor(next: Laterality, exerciseId: string) {
    if (next === laterality) return;
    const exercise = data?.exercises.find((e) => e.id === exerciseId);
    const equipment = exercise ? equipmentForExercise(exercise) : "other";
    const converted = convertLoadForLaterality(
      totalDisplay,
      laterality,
      next,
      loadSharing(inputMode, equipment),
      unit,
    );
    lateralityRef.current = next;
    setLaterality(next);
    if (inputMode === "dumbbell") setDumbbell(nearestDumbbell(converted, unit));
    else if (inputMode === "manual") setManualWeight(converted);
    void patchExercisePref(exerciseId, { preferredLaterality: next });
  }

  async function logSet(
    exerciseId: string,
    weightLb: number,
    repsToLog: number,
    inputMethod: InputMethod,
    loadBreakdown?: LoadBreakdown,
    setLateralityValue?: Laterality,
  ) {
    const sessionId = await ensureSession();
    const session = await db.sessions.get(sessionId);
    const existing = logsByExercise.get(exerciseId) ?? [];
    const setNumber = existing.length + 1;
    const warmupDone = existing.filter((s) => s.isWarmup).length;
    const isWarmup = warmupDone < (data?.warmupTargets[exerciseId] ?? 0);
    await db.setLogs.add({
      id: newId(),
      sessionId,
      exerciseId,
      setNumber,
      weight: weightLb,
      reps: repsToLog,
      inputMethod,
      loadBreakdown,
      laterality: setLateralityValue,
      isWarmup: isWarmup || undefined,
      swappedFromExerciseId: session?.exerciseSwapOrigins?.[exerciseId],
    });
    // A logged set reopens an exercise that was called done.
    if (finishedIds.has(exerciseId)) {
      await setExerciseFinished(sessionId, exerciseId, false);
    }
    setFollowDerived(true);
    setSelectedId(exerciseId);

    if (isWarmup) {
      setTimerVisible(false);
      return;
    }

    const group = (data?.supersets ?? []).find(
      (g) => g.includes(exerciseId) && g.length >= 2,
    );
    if (group && data) {
      const ordered = orderedGroup(data.exerciseIds, group);
      const nextWorking =
        workingSets(existing).length + 1;
      const partnerBehind = ordered.some(
        (id) =>
          id !== exerciseId &&
          workingSets(logsByExercise.get(id) ?? []).length < nextWorking,
      );
      if (partnerBehind) {
        const at = ordered.indexOf(exerciseId);
        const nextId = ordered[(at + 1) % ordered.length];
        setSelectedId(nextId);
        setTimerVisible(false);
        return;
      }
    }

    const rest =
      data?.restSeconds[exerciseId] ?? DEFAULT_REST_SECONDS;
    setRestDuration(rest);
    setTimerExerciseId(exerciseId);
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
        inputMode === "barbell"
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
    const rest = data?.restSeconds[exerciseId] ?? DEFAULT_REST_SECONDS;
    setRestDuration(rest);
    setTimerExerciseId(exerciseId);
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
    if (loggingRef.current) return;
    loggingRef.current = true;
    try {
      const breakdown: LoadBreakdown | undefined =
        inputMode === "barbell"
          ? {
              barWeight: toCanonical(barWeight, unit),
              platesPerSide: plates.map((p) => toCanonical(p, unit)),
            }
          : undefined;
      const exercise = data?.exercises.find((e) => e.id === exerciseId);
      const equipment = exercise ? equipmentForExercise(exercise) : "other";
      await logSet(
        exerciseId,
        toCanonical(totalDisplay, unit),
        reps,
        inputMode,
        breakdown,
        supportsLaterality(inputMode, equipment) ? laterality : undefined,
      );
    } finally {
      loggingRef.current = false;
    }
  }

  function cycleMode(
    exerciseId: string,
    dir: -1 | 1,
    available: ReturnType<typeof inputModesForEquipment>,
    current: InputMethod,
  ) {
    const i = available.findIndex((m) => m.id === current);
    const at = i < 0 ? 0 : i;
    const next = available[(at + dir + available.length) % available.length];
    if (next && next.id !== current) setMode(next.id, exerciseId);
  }

  async function undoLastLog(exerciseId: string) {
    const logged = logsByExercise.get(exerciseId) ?? [];
    const last = logged[logged.length - 1];
    if (!last) return;
    if (last.drops?.length) {
      await deleteSetDrop(last.id, last.drops.length - 1);
    } else {
      await deleteSetLog(last.id);
    }
    setTimerVisible(false);
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
          laterality: planned.laterality,
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

  async function handleRemoveExercise(exerciseId: string) {
    const sessionId = await ensureSession();
    await removeSessionExercise(sessionId, exerciseId);
    if (selectedId === exerciseId) setSelectedId(null);
    setSwappingIndex(null);
    setEditingNote(null);
  }

  async function handleToggleSuperset(index: number) {
    const sessionId = await ensureSession();
    await toggleSessionSuperset(sessionId, index);
  }

  async function handleToggleWarmup(exerciseId: string) {
    const sessionId = await ensureSession();
    const current = data!.warmupTargets[exerciseId] ?? 0;
    await setSessionWarmupTarget(
      sessionId,
      exerciseId,
      current > 0 ? 0 : DEFAULT_WARMUP_COUNT,
    );
  }

  async function handleSessionNote(exerciseId: string, note: string) {
    const sessionId = await ensureSession();
    await setSessionNote(sessionId, exerciseId, note);
    setEditingNote(null);
  }

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="shrink-0 pr-2">
          <DaySwitcher
            dayName={data.dayName}
            currentId={data.currentTemplateId}
            scheduledId={data.scheduledTemplateId}
            options={data.switchOptions}
            onSwitch={handleDaySwitch}
          />
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

      <ul>
        {data.exercises.map((exercise, index) => {
          const logged = logsByExercise.get(exercise.id) ?? [];
          const isActive = exercise.id === activeId;
          const finished = finishedIds.has(exercise.id);
          const prior = data.prefills[exercise.id] ?? [];
          const dragProps = getItemProps(index);
          const equipment = equipmentForExercise(exercise);
          const modes = inputModesForEquipment(equipment);
          const activeMode = modes.some((m) => m.id === mode)
            ? mode
            : modes[0]?.id ?? "manual";
          const showLaterality = supportsLaterality(activeMode, equipment);
          const ghostSource = prior.length
            ? (prior[activeWorkingCount] ?? prior[prior.length - 1])
            : undefined;
          const ghostWeight = ghostSource
            ? toDisplay(ghostSource.weight, unit)
            : null;
          const grouped = inSuperset(data.supersets, exercise.id);
          const sessionNote = data.exerciseNotes[exercise.id];
          const stickyNote = data.stickyNotes[exercise.id];
          const warmupOn = (data.warmupTargets[exercise.id] ?? 0) > 0;
          const rest = data.restSeconds[exercise.id];
          const editing =
            editingNote?.id === exercise.id ? editingNote.kind : null;
          const hasFormVideo = formClipsFor(exercise.id).length > 0;
          const showingVideo = formVideoId === exercise.id;

          return (
            <TodayExerciseTile
              key={exercise.id}
              exercise={exercise}
              logged={logged}
              isActive={isActive}
              finished={finished}
              isSwapping={swappingIndex === index}
              excludeSwapIds={data.exerciseIds.filter((id) => id !== exercise.id)}
              reorderIndex={index}
              dragRowClassName={dragProps.className}
              dragStyle={dragProps.style}
              groupPos={groupPosFor(data.exerciseIds, data.supersets, exercise.id)}
              inSuperset={grouped}
              overflow={
                <ItemOverflow
                  label={`${exercise.name} options`}
                  items={[
                    {
                      id: "note",
                      label: sessionNote ? "Edit note" : "Add note",
                      icon: <IconNote />,
                      onSelect: () =>
                        setEditingNote({ id: exercise.id, kind: "session" }),
                    },
                    {
                      id: "sticky",
                      label: stickyNote ? "Edit sticky note" : "Add sticky note",
                      icon: <IconSticky />,
                      onSelect: () =>
                        setEditingNote({ id: exercise.id, kind: "sticky" }),
                    },
                    {
                      id: "warmup",
                      label: warmupOn
                        ? "Remove warm-up sets"
                        : "Add warm-up sets",
                      icon: <IconWarmup />,
                      onSelect: () => void handleToggleWarmup(exercise.id),
                    },
                    {
                      id: "rest",
                      label: rest
                        ? `Rest timer · ${formatRest(rest)}`
                        : "Rest timer",
                      icon: <IconRest />,
                      panel: ({ close }) => (
                        <RestPresetPanel
                          value={rest ?? DEFAULT_REST_SECONDS}
                          onPick={(seconds) =>
                            void patchExercisePref(exercise.id, {
                              restSeconds: seconds,
                            })
                          }
                          close={close}
                        />
                      ),
                    },
                    {
                      id: "replace",
                      label: "Replace",
                      icon: <IconReplace />,
                      onSelect: () => {
                        setFollowDerived(true);
                        setSelectedId(exercise.id);
                        setSwappingIndex(index);
                      },
                    },
                    ...(hasFormVideo
                      ? [
                          {
                            id: "video",
                            label: showingVideo
                              ? "Hide form video"
                              : "Form video",
                            icon: <IconVideo />,
                            onSelect: () =>
                              setFormVideoId((current) =>
                                current === exercise.id ? null : exercise.id,
                              ),
                          },
                        ]
                      : []),
                    {
                      id: "history",
                      label: "History",
                      icon: <IconHistory />,
                      onSelect: () => navigate(`/exercise/${exercise.id}`),
                    },
                    {
                      id: "superset",
                      label: grouped ? "Break superset" : "Create superset",
                      icon: <IconSuperset />,
                      disabled: data.exercises.length < 2,
                      onSelect: () => void handleToggleSuperset(index),
                    },
                    {
                      id: "done",
                      label: finished ? "Reopen" : "Mark done",
                      icon: <IconDone />,
                      onSelect: () =>
                        void toggleExerciseFinished(exercise.id, !finished),
                    },
                    {
                      id: "remove",
                      label: "Remove",
                      icon: <IconRemove />,
                      danger: true,
                      separatorBefore: true,
                      onSelect: () => void handleRemoveExercise(exercise.id),
                    },
                  ]}
                />
              }
              notes={
                stickyNote || sessionNote || editing ? (
                  <>
                    {stickyNote && editing !== "sticky" && (
                      <p className="text-[13px] leading-relaxed text-muted">
                        {stickyNote}
                      </p>
                    )}
                    {sessionNote && editing !== "session" && (
                      <p className="text-[13px] leading-relaxed text-ink">
                        {sessionNote}
                      </p>
                    )}
                    {editing === "session" && (
                      <NoteEditor
                        initial={sessionNote ?? ""}
                        placeholder="Note for this session"
                        label={`Note for ${exercise.name}`}
                        onCommit={(value) =>
                          void handleSessionNote(exercise.id, value)
                        }
                        onCancel={() => setEditingNote(null)}
                      />
                    )}
                    {editing === "sticky" && (
                      <NoteEditor
                        initial={stickyNote ?? ""}
                        placeholder="Sticky note — stays on this exercise"
                        label={`Sticky note for ${exercise.name}`}
                        onCommit={(value) => {
                          void patchExercisePref(exercise.id, {
                            stickyNote: value,
                          });
                          setEditingNote(null);
                        }}
                        onCancel={() => setEditingNote(null)}
                      />
                    )}
                  </>
                ) : null
              }
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
              onCancelSwap={() => setSwappingIndex(null)}
              onSwapPick={(entry) => void handleSwapExercise(index, entry)}
              formatLoggedSet={(s) => formatSet(s, (lb) => toDisplay(lb, unit))}
              onUndoLast={() => void undoLastLog(exercise.id)}
              undoLastHasDrop={
                (logged[logged.length - 1]?.drops?.length ?? 0) > 0
              }
            >
              {showingVideo && (
                <FormVideoPanel
                  exerciseId={exercise.id}
                  open
                  className="border-t border-hairline pt-3 pb-1"
                />
              )}
              {isActive && (
                <div className="border-t border-hairline py-4">
                  <LoadInstrument
                    weight={totalDisplay}
                    unit={unit}
                    ghost={ghostWeight}
                    modes={modes}
                    mode={activeMode}
                    onModeChange={(next) => setMode(next, exercise.id)}
                    weightDisplay={
                      activeMode === "barbell" ? (
                        <BarWeightControl
                          unit={unit}
                          barWeight={barWeight}
                          plates={plates}
                          onChange={(bar, next) => {
                            setBarWeight(bar);
                            setPlates(next);
                          }}
                        />
                      ) : undefined
                    }
                    stage={
                      activeMode === "barbell" ? (
                        <BarbellPicker
                          key={`${exercise.id}:${unit}`}
                          unit={unit}
                          barWeight={barWeight}
                          plates={plates}
                          onChange={(bar, next) => {
                            setBarWeight(bar);
                            setPlates(next);
                          }}
                          onSwipe={
                            modes.length > 1
                              ? (dir) =>
                                  cycleMode(
                                    exercise.id,
                                    dir,
                                    modes,
                                    activeMode,
                                  )
                              : undefined
                          }
                        />
                      ) : activeMode === "dumbbell" ? (
                        <DumbbellPicker
                          unit={unit}
                          value={dumbbell}
                          laterality={laterality}
                          onChange={setDumbbell}
                          onToggleLaterality={() =>
                            setLateralityFor(
                              laterality === "bilateral"
                                ? "unilateral"
                                : "bilateral",
                              exercise.id,
                            )
                          }
                          onSwipe={
                            modes.length > 1
                              ? (dir) =>
                                  cycleMode(
                                    exercise.id,
                                    dir,
                                    modes,
                                    activeMode,
                                  )
                              : undefined
                          }
                        />
                      ) : undefined
                    }
                  >
                    {activeMode === "barbell" && (
                      <BarbellRack
                        unit={unit}
                        barWeight={barWeight}
                        plates={plates}
                        onChange={(bar, next) => {
                          setBarWeight(bar);
                          setPlates(next);
                        }}
                      />
                    )}
                    {activeMode === "manual" && (
                      <div className="flex flex-col items-center">
                        <Stepper
                          label={`Weight (${unit})`}
                          value={manualWeight}
                          step={MANUAL_STEP[unit]}
                          onChange={setManualWeight}
                        />
                      </div>
                    )}
                  </LoadInstrument>

                  {showLaterality && activeMode !== "dumbbell" && (
                    <div className="mt-3 flex justify-center">
                      <LateralityToggle
                        value={laterality}
                        onChange={(next) =>
                          setLateralityFor(next, exercise.id)
                        }
                        variant="arms"
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

                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => logCurrent(exercise.id)}
                      className="btn-primary h-12 w-full rounded-pill bg-accent text-[15px] font-semibold text-bg hover:bg-ink"
                    >
                      {loggingWarmup
                        ? `Log warm-up ${formatWeight(totalDisplay)}×${reps}`
                        : `Log ${formatWeight(totalDisplay)}×${reps}`}
                    </button>
                  </div>

                  {logged.length > 0 && (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => void logDrop(exercise.id)}
                        aria-label={`Add a drop to set ${logged.length} of ${exercise.name}`}
                        className="glass-btn h-12 w-full rounded-pill text-[15px] font-medium text-ink"
                      >
                        Add drop to set {logged.length}
                      </button>
                    </div>
                  )}
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
          onAdjustDuration={(seconds) => {
            setRestDuration(seconds);
            if (timerExerciseId) {
              void patchExercisePref(timerExerciseId, { restSeconds: seconds });
            }
          }}
          onDismiss={() => setTimerVisible(false)}
        />
      )}
    </div>
  );
}
