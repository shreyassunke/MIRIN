import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  formatWeight,
  lastNativeSets,
  newId,
  planFillFromLastTime,
} from "../lib/workout";
import { dayTemplateIdForDate, nextWorkout, toLocalISODate } from "../lib/rotation";
import { REST_DAY_TEMPLATE } from "../db/seed";
import {
  applyTodaySwitch,
  persistSplitExerciseSelections,
  resolvedTodayTemplateId,
  uniqueDayOptions,
  type DaySwitchOption,
  type TodaySwitchMode,
} from "../lib/splits";
import {
  ensureExerciseRow,
  equipmentForExercise,
  isGymMachineId,
  type ExerciseLibraryEntry,
} from "../lib/library";
import type { CableAttachmentId } from "../lib/cableAttachment";
import { supportsLaterality, type Laterality } from "../lib/laterality";
import {
  choiceForDraft,
  draftPatchForVariation,
  variationById,
  type VariationChoice,
} from "../lib/variations";
import {
  appendSessionExercise,
  removeSessionExercise,
  resolveSessionExerciseIds,
  resolveSessionSupersets,
  resolveSessionWarmupTargets,
  setExerciseFinished,
  setSessionNote,
  setSessionStation,
  setSessionVariation,
  setSessionWarmupTarget,
  swapSessionExercise,
  toggleSessionSuperset,
} from "../lib/session";
import {
  DEFAULT_WARMUP_COUNT,
  formatRest,
  inSuperset,
  orderedGroup,
  patchExercisePref,
  workingSets,
} from "../lib/exerciseMeta";
import { ExerciseCombobox, HeaderExerciseSearch } from "../components/ExerciseCombobox";
import { LogActionSwipe } from "../components/LogActionSwipe";
import { TodayExercisePage } from "../components/TodayExerciseTile";
import { ExerciseDeck } from "../components/ExerciseDeck";
import {
  exerciseStageTitle,
  TodayExerciseStage,
} from "../components/TodayExerciseStage";
import { NoteEditor } from "../components/NoteEditor";
import { FormVideoPanel } from "../components/FormVideo";
import { formClipsFor } from "../lib/formVideos";
import {
  IconAddSet,
  IconDone,
  IconHistory,
  IconNote,
  IconRemove,
  IconRest,
  IconSticky,
  IconSuperset,
  IconSwap,
  IconVideo,
  IconWarmup,
  ItemOverflow,
  RestPresetPanel,
} from "../components/ItemOverflow";
import { toCanonical, type InputMethod } from "../lib/units";
import {
  resolveStageDraft,
  stageTotal,
  syncStageDrafts,
  type StageDraft,
} from "../lib/stageDraft";
import { useUnit } from "../lib/settings";
import { RestClockProvider } from "../components/RestTimer";
import { UnitToggle } from "../components/UnitToggle";
import { DaySwitcher } from "../components/DaySwitcher";
import { LoggedSets } from "../components/LoggedSetGhost";

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
  cableAttachmentPrefs: Record<string, CableAttachmentId>;
  stickyNotes: Record<string, string>;
  restSeconds: Record<string, number>;
  exerciseNotes: Record<string, string>;
  supersets: string[][];
  warmupTargets: Record<string, number>;
  /** Exercises the user called done; sets per exercise are otherwise unfixed. */
  finishedExerciseIds: string[];
  /** Today's substitute implement, keyed by programmed exercise id. */
  variations: Record<string, string>;
  /** Today's machine station, keyed by programmed exercise id. */
  stations: Record<string, string>;
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
        prefills[exercise.id] = await lastNativeSets(exercise.id, open?.id);
      }
      const modePrefs: Record<string, InputMethod> = {};
      const lateralityPrefs: Record<string, Laterality> = {};
      const cableAttachmentPrefs: Record<string, CableAttachmentId> = {};
      const stickyNotes: Record<string, string> = {};
      const restSeconds: Record<string, number> = {};
      for (const pref of await db.exercisePrefs.toArray()) {
        if (pref.preferredInputMethod) {
          modePrefs[pref.exerciseId] = pref.preferredInputMethod;
        }
        if (pref.preferredLaterality) {
          lateralityPrefs[pref.exerciseId] = pref.preferredLaterality;
        }
        if (
          pref.preferredCableAttachment === "straight" ||
          pref.preferredCableAttachment === "ez" ||
          pref.preferredCableAttachment === "close" ||
          pref.preferredCableAttachment === "rope" ||
          pref.preferredCableAttachment === "stirrup"
        ) {
          cableAttachmentPrefs[pref.exerciseId] = pref.preferredCableAttachment;
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
        cableAttachmentPrefs,
        stickyNotes,
        restSeconds,
        exerciseNotes: open?.exerciseNotes ?? {},
        supersets: resolveSessionSupersets(undefined, open),
        warmupTargets: resolveSessionWarmupTargets(undefined, open),
        finishedExerciseIds: open?.finishedExerciseIds ?? [],
        variations: open?.variations ?? {},
        stations: open?.stations ?? {},
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
      prefills[exercise.id] = await lastNativeSets(exercise.id, open?.id);
    }

    const modePrefs: Record<string, InputMethod> = {};
    const lateralityPrefs: Record<string, Laterality> = {};
    const cableAttachmentPrefs: Record<string, CableAttachmentId> = {};
    const stickyNotes: Record<string, string> = {};
    const restSeconds: Record<string, number> = {};
    for (const pref of await db.exercisePrefs.toArray()) {
      if (pref.preferredInputMethod) {
        modePrefs[pref.exerciseId] = pref.preferredInputMethod;
      }
      if (pref.preferredLaterality) {
        lateralityPrefs[pref.exerciseId] = pref.preferredLaterality;
      }
      if (
        pref.preferredCableAttachment === "straight" ||
        pref.preferredCableAttachment === "ez" ||
        pref.preferredCableAttachment === "close" ||
        pref.preferredCableAttachment === "rope" ||
        pref.preferredCableAttachment === "stirrup"
      ) {
        cableAttachmentPrefs[pref.exerciseId] = pref.preferredCableAttachment;
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
      cableAttachmentPrefs,
      stickyNotes,
      restSeconds,
      exerciseNotes: open?.exerciseNotes ?? {},
      supersets: resolveSessionSupersets(day, open),
      warmupTargets: resolveSessionWarmupTargets(day, open),
      finishedExerciseIds: open?.finishedExerciseIds ?? [],
      variations: open?.variations ?? {},
      stations: open?.stations ?? {},
      isRestDay: false,
      nextUp: null,
    };
  }, []);
}

function usePhoneLayout() {
  const query = "(max-width: 767px)";
  const [phone, setPhone] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setPhone(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return phone;
}

export function Today() {
  const data = useTodayData();
  const navigate = useNavigate();
  const [unit] = useUnit();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** When false, derived selection is paused (no unfinished exercise to follow). */
  const [followDerived, setFollowDerived] = useState(true);
  const [restDuration, setRestDuration] = useState(DEFAULT_REST_SECONDS);
  const [timerRun, setTimerRun] = useState(0);
  const [timerVisible, setTimerVisible] = useState(false);
  const [addingExercise, setAddingExercise] = useState(false);
  const [swappingIndex, setSwappingIndex] = useState<number | null>(null);
  const [variationTick, setVariationTick] = useState<Record<string, number>>({});
  const [timerExerciseId, setTimerExerciseId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<{
    id: string;
    kind: "session" | "sticky";
  } | null>(null);
  const [formVideoId, setFormVideoId] = useState<string | null>(null);
  const phone = usePhoneLayout();
  const [setDock, setSetDock] = useState<HTMLDivElement | null>(null);
  const assignDock = useCallback((node: HTMLDivElement | null) => {
    setSetDock(node);
  }, []);
  const loggingRef = useRef(false);
  /** Completing fills sets from last session, so it takes a second tap. */
  const [finishArmed, setFinishArmed] = useState(false);
  /** Per-exercise stage. Neighbors keep their own numbers so a swipe never borrows the previous page. */
  const [drafts, setDrafts] = useState<Record<string, StageDraft>>({});

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

  const activeId =
    (followDerived ? (selectedId ?? derivedActiveId) : selectedId) ??
    data?.exercises[data.exercises.length - 1]?.id ??
    null;
  const draftSeed =
    data == null
      ? ""
      : [
          data.dayTemplateId ?? "rest",
          unit,
          data.exercises
            .map((exercise) => {
              const logs = logsByExercise.get(exercise.id) ?? [];
              const working = logs.filter((log) => !log.isWarmup).length;
              const warmup = logs.filter((log) => log.isWarmup).length;
              const target = data.warmupTargets[exercise.id] ?? 0;
              const prior = data.prefills[exercise.id]?.length ?? 0;
              return `${exercise.id}:${working}:${warmup}:${target}:${prior}`;
            })
            .join(","),
        ].join("|");

  const viewDrafts =
    data == null
      ? drafts
      : syncStageDrafts(data.exercises, drafts, {
          unit,
          dayTemplateId: data.dayTemplateId,
          logsByExercise,
          prefills: data.prefills,
          modePrefs: data.modePrefs,
          lateralityPrefs: data.lateralityPrefs,
          cableAttachmentPrefs: data.cableAttachmentPrefs,
          warmupTargets: data.warmupTargets,
          variations: data.variations,
          stations: data.stations,
        }).next;

  useLayoutEffect(() => {
    if (!data) return;
    setDrafts((prev) => {
      const synced = syncStageDrafts(data.exercises, prev, {
        unit,
        dayTemplateId: data.dayTemplateId,
        logsByExercise,
        prefills: data.prefills,
        modePrefs: data.modePrefs,
        lateralityPrefs: data.lateralityPrefs,
        cableAttachmentPrefs: data.cableAttachmentPrefs,
        warmupTargets: data.warmupTargets,
        variations: data.variations,
        stations: data.stations,
      });
      return synced.changed ? synced.next : prev;
    });
  }, [data, draftSeed, logsByExercise, unit]);

  const loggedForActive = activeId ? (logsByExercise.get(activeId) ?? []) : [];

  // Never leave the fill-and-complete confirmation armed behind the user.
  useEffect(() => {
    if (!finishArmed) return;
    const timeout = setTimeout(() => setFinishArmed(false), 5000);
    return () => clearTimeout(timeout);
  }, [finishArmed]);

  const handleDaySwitch = useCallback(
    (id: string, mode: TodaySwitchMode) => {
      if (!data) return;
      const splitId = data.splitId;
      void (async () => {
        await persistSplitExerciseSelections(splitId);
        await applyTodaySwitch(splitId, id, mode);
      })();
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
        <header className="today-header mb-6 flex flex-nowrap items-start justify-between gap-3">
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
          <div className="flex shrink-0 items-center">
            <UnitToggle />
            <HeaderExerciseSearch
              open={addingExercise}
              onOpen={() => setAddingExercise(true)}
              onClose={() => setAddingExercise(false)}
              excludeIds={data.exerciseIds}
              onPick={async (entry) => {
                const id = await ensureExerciseRow(entry);
                await addAdHocExercise(id);
              }}
            />
          </div>
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
      </div>
    );
  }

  const activeExercise = data.exercises.find((e) => e.id === activeId);
  const activeDraft = activeId ? viewDrafts[activeId] : undefined;
  const activeDisplayName =
    activeExercise && activeDraft
      ? exerciseStageTitle(activeExercise, activeDraft)
      : "";
  const anyLogged = data.logs.length > 0;
  const showComplete = anyLogged && fillPlan.length === 0;
  const activeIndex = Math.max(
    0,
    data.exercises.findIndex((e) => e.id === activeId),
  );
  const loggedSets = loggedForActive;

  function patchDraft(exerciseId: string, partial: Partial<StageDraft>) {
    setDrafts((prev) => {
      const current = viewDrafts[exerciseId] ?? prev[exerciseId];
      if (!current) return prev;
      return { ...prev, [exerciseId]: { ...current, ...partial } };
    });
  }

  function setMode(next: InputMethod, exerciseId: string) {
    if (!data) return;
    const today = data;
    const exercise = today.exercises.find((item) => item.id === exerciseId);
    const current = viewDrafts[exerciseId];
    if (exercise && current && current.mode !== next) {
      setDrafts((prev) => ({
        ...prev,
        [exerciseId]: resolveStageDraft({
          exercise,
          logs: logsByExercise.get(exerciseId) ?? [],
          prior: today.prefills[exerciseId] ?? [],
          warmupTarget: today.warmupTargets[exerciseId] ?? 0,
          unit,
          dayTemplateId: today.dayTemplateId,
          modePref: next,
          lateralityPref: current.laterality,
          cableAttachmentPref: current.cableAttachment,
          carry: {
            mode: next,
            laterality: current.laterality,
            cableAttachment: current.cableAttachment,
            variationId: current.variationId,
            heldLoadLb: current.heldLoadLb,
            station: current.station,
          },
        }),
      }));
    }
    void patchExercisePref(exerciseId, { preferredInputMethod: next });
  }

  async function applyVariation(exerciseId: string, choice: VariationChoice) {
    if (!data) return;
    const current = viewDrafts[exerciseId];
    const exercise = data.exercises.find((item) => item.id === exerciseId);
    if (!current || !exercise) return;
    const from = choiceForDraft(exercise, current);
    if (from.id === choice.id) return;
    const patch = draftPatchForVariation({
      exercise,
      from,
      to: choice,
      total: stageTotal(current),
      heldLoadLb: current.heldLoadLb,
      barWeight: current.barWeight,
      unit,
    });
    patchDraft(exerciseId, patch);
    const sessionId = await ensureSession();
    await setSessionVariation(sessionId, exerciseId, patch.variationId ?? undefined);
  }

  async function applyStation(exerciseId: string, station: string) {
    if (!isGymMachineId(station)) return;
    patchDraft(exerciseId, { station });
    const sessionId = await ensureSession();
    await setSessionStation(sessionId, exerciseId, station);
  }

  function setAttachment(next: CableAttachmentId, exerciseId: string) {
    const current = viewDrafts[exerciseId];
    if (!current || next === current.cableAttachment) return;
    patchDraft(exerciseId, { cableAttachment: next });
    void patchExercisePref(exerciseId, { preferredCableAttachment: next });
  }

  async function logSet(
    exerciseId: string,
    weightLb: number,
    repsToLog: number,
    inputMethod: InputMethod,
    loadBreakdown?: LoadBreakdown,
    setLateralityValue?: Laterality,
    options?: {
      drops?: SetDrop[];
      forceWorking?: boolean;
      variationId?: string;
      variationLabel?: string;
    },
  ) {
    const sessionId = await ensureSession();
    const session = await db.sessions.get(sessionId);
    const existing = logsByExercise.get(exerciseId) ?? [];
    const setNumber = existing.length + 1;
    const warmupDone = existing.filter((s) => s.isWarmup).length;
    const isWarmup = options?.forceWorking
      ? false
      : warmupDone < (data?.warmupTargets[exerciseId] ?? 0);
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
      drops: options?.drops,
      isWarmup: isWarmup || undefined,
      swappedFromExerciseId: session?.exerciseSwapOrigins?.[exerciseId],
      variationId: options?.variationId,
      variationLabel: options?.variationLabel,
    });
    setFinishArmed(false);
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
    const draft = viewDrafts[exerciseId];
    if (!draft) return;
    const drop: SetDrop = {
      weight: toCanonical(stageTotal(draft), unit),
      reps: draft.reps,
      loadBreakdown:
        draft.mode === "barbell"
          ? {
              barWeight: toCanonical(draft.barWeight, unit),
              platesPerSide: draft.plates.map((plate) => toCanonical(plate, unit)),
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
      const draft = viewDrafts[exerciseId];
      if (!draft) return;
      const breakdown: LoadBreakdown | undefined =
        draft.mode === "barbell"
          ? {
              barWeight: toCanonical(draft.barWeight, unit),
              platesPerSide: draft.plates.map((plate) =>
                toCanonical(plate, unit),
              ),
            }
          : undefined;
      const exercise = data?.exercises.find((e) => e.id === exerciseId);
      const equipment = exercise
        ? (variationById(exercise, draft.variationId)?.equipment ??
          equipmentForExercise(exercise))
        : "other";
      const variation = exercise
        ? variationById(exercise, draft.variationId)
        : null;
      await logSet(
        exerciseId,
        toCanonical(stageTotal(draft), unit),
        draft.reps,
        draft.mode,
        breakdown,
        supportsLaterality(draft.mode, equipment) ? draft.laterality : undefined,
        variation
          ? { variationId: variation.id, variationLabel: variation.label }
          : undefined,
      );
    } finally {
      loggingRef.current = false;
    }
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
    const at = data?.exercises.findIndex((e) => e.id === exerciseId) ?? -1;
    const neighbor =
      at >= 0
        ? (data!.exercises[at + 1] ?? data!.exercises[at - 1])
        : undefined;
    await removeSessionExercise(sessionId, exerciseId);
    if (selectedId === exerciseId || activeId === exerciseId) {
      setSelectedId(neighbor?.id ?? null);
    }
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

  const activeSessionNote = activeId ? data.exerciseNotes[activeId] : undefined;
  const activeStickyNote = activeId ? data.stickyNotes[activeId] : undefined;
  const activeEditing =
    editingNote?.id === activeId ? editingNote.kind : null;
  const showContext =
    Boolean(
      activeId && (activeStickyNote || activeSessionNote || activeEditing),
    ) || Boolean(activeId && formVideoId === activeId);
  const showLower = showContext || (!phone && showComplete);
  const completeControl = showComplete ? (
    <div className={phone ? "set-finish" : "mt-6"}>
      <button
        type="button"
        onClick={() =>
          finishArmed ? void finishWorkout() : setFinishArmed(true)
        }
        className={[
          "h-12 w-full rounded-pill text-[15px] font-semibold",
          activeId === null
            ? "btn-primary bg-accent text-bg hover:bg-ink"
            : "glass-btn text-ink",
        ].join(" ")}
      >
        {finishArmed ? "Confirm" : "Complete workout"}
      </button>
    </div>
  ) : null;

  return (
    <RestClockProvider
      active={timerVisible}
      runId={timerRun}
      duration={restDuration}
      onAdjustDuration={(seconds) => {
        setRestDuration(seconds);
        if (timerExerciseId) {
          void patchExercisePref(timerExerciseId, { restSeconds: seconds });
        }
      }}
      onDismiss={() => setTimerVisible(false)}
    >
    <div className="today-phone-frame">
      <div className="today-phone-scroll">
      <header className="today-header mb-2 flex flex-nowrap items-start justify-between gap-3 md:mb-4">
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
        <div className="flex shrink-0 items-center">
          <HeaderExerciseSearch
            open={addingExercise}
            onOpen={() => setAddingExercise(true)}
            onClose={() => setAddingExercise(false)}
            excludeIds={data.exerciseIds}
            onPick={async (entry) => {
              const id = await ensureExerciseRow(entry);
              await addAdHocExercise(id);
            }}
          />
        </div>
      </header>

      {data.exercises.length > 0 && (
        <ExerciseDeck
          index={activeIndex}
          frameKey={data.exerciseIds.join("\0")}
          pageLabels={data.exercises.map((exercise) => {
            const draft = viewDrafts[exercise.id];
            return draft
              ? exerciseStageTitle(exercise, draft)
              : exercise.name;
          })}
          onIndexChange={(next) => {
            const id = data.exercises[next]?.id;
            if (!id) return;
            setFollowDerived(true);
            setSelectedId(id);
            setSwappingIndex(null);
          }}
          label={activeDisplayName || "Exercises"}
        >
          {data.exercises.map((exercise, index) => {
            const draft = viewDrafts[exercise.id];
            const finished = finishedIds.has(exercise.id);
            const displayName = draft
              ? exerciseStageTitle(exercise, draft)
              : exercise.name;
            const grouped = inSuperset(data.supersets, exercise.id);
            const sessionNote = data.exerciseNotes[exercise.id];
            const stickyNote = data.stickyNotes[exercise.id];
            const warmupOn = (data.warmupTargets[exercise.id] ?? 0) > 0;
            const rest = data.restSeconds[exercise.id];
            const hasFormVideo = formClipsFor(exercise.id).length > 0;
            const showingVideo = formVideoId === exercise.id;

            return (
              <TodayExercisePage
                key={exercise.id}
                exercise={exercise}
                inSuperset={grouped}
                title={displayName}
                onReplace={() => {
                  setFollowDerived(true);
                  setSelectedId(exercise.id);
                  setSwappingIndex(index);
                }}
                replacing={
                  swappingIndex === index ? (
                    <ExerciseCombobox
                      inline
                      placeholder={displayName}
                      excludeIds={data.exerciseIds.filter(
                        (id) => id !== exercise.id,
                      )}
                      onCancel={() => setSwappingIndex(null)}
                      onPick={(entry) =>
                        void handleSwapExercise(index, entry)
                      }
                    />
                  ) : undefined
                }
                overflow={
                  <ItemOverflow
                    label={`${displayName} options`}
                    items={[
                      {
                        id: "add",
                        label: "Add exercise",
                        icon: <IconAddSet />,
                        onSelect: () => setAddingExercise(true),
                      },
                      {
                        id: "variation",
                        label: "Change exercise",
                        icon: <IconSwap />,
                        onSelect: () =>
                          setVariationTick((prev) => ({
                            ...prev,
                            [exercise.id]: (prev[exercise.id] ?? 0) + 1,
                          })),
                      },
                      {
                        id: "note",
                        label: sessionNote ? "Edit note" : "Add note",
                        icon: <IconNote />,
                        onSelect: () =>
                          setEditingNote({ id: exercise.id, kind: "session" }),
                      },
                      {
                        id: "sticky",
                        label: stickyNote
                          ? "Edit sticky note"
                          : "Add sticky note",
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
              >
                {draft ? (
                  <TodayExerciseStage
                    exercise={exercise}
                    draft={draft}
                    unit={unit}
                    live={exercise.id === activeId}
                    onMode={(next) => setMode(next, exercise.id)}
                    onReps={(reps) => patchDraft(exercise.id, { reps })}
                    onDumbbell={(value) =>
                      patchDraft(exercise.id, { dumbbell: value })
                    }
                    onManual={(value) =>
                      patchDraft(exercise.id, { manualWeight: value })
                    }
                    onBar={(bar, plates) =>
                      patchDraft(exercise.id, { barWeight: bar, plates })
                    }
                    onAttachment={(next) => setAttachment(next, exercise.id)}
                    onVariation={(choice) => void applyVariation(exercise.id, choice)}
                    onStation={(id) => void applyStation(exercise.id, id)}
                    headerCaption={draft.loggingWarmup ? "Warm-up" : undefined}
                    headerDock={
                      phone && setDock && exercise.id === activeId
                        ? setDock
                        : null
                    }
                    suppressHeader={Boolean(
                      phone && setDock && exercise.id !== activeId,
                    )}
                    variationRequest={variationTick[exercise.id] ?? 0}
                    logbook={
                      !phone && exercise.id === activeId ? (
                        <LoggedSets sets={loggedForActive} unit={unit} />
                      ) : undefined
                    }
                    headerAction={
                      <LogActionSwipe
                        key={exercise.id}
                        canDrop={(logsByExercise.get(exercise.id) ?? []).length > 0}
                        logLabel={
                          draft.loggingWarmup
                            ? `Log warm-up ${formatWeight(stageTotal(draft))}×${draft.reps}`
                            : `Log ${formatWeight(stageTotal(draft))}×${draft.reps}`
                        }
                        dropAria={`Add a drop to set ${(logsByExercise.get(exercise.id) ?? []).length} of ${exercise.name}`}
                        onLog={() => logCurrent(exercise.id)}
                        onDrop={() => void logDrop(exercise.id)}
                        rest={timerVisible && exercise.id === timerExerciseId}
                      />
                    }
                  />
                ) : null}
              </TodayExercisePage>
            );
          })}
        </ExerciseDeck>
      )}
      </div>

      {showLower ? (
      <div className="today-lower">
      {activeId && (activeStickyNote || activeSessionNote || activeEditing) && (
        <div className="mt-2 text-left md:mt-4">
          {activeStickyNote && activeEditing !== "sticky" && (
            <p className="text-[13px] leading-relaxed text-muted">
              {activeStickyNote}
            </p>
          )}
          {activeSessionNote && activeEditing !== "session" && (
            <p className="text-[13px] leading-relaxed text-ink">
              {activeSessionNote}
            </p>
          )}
          {activeEditing === "session" && (
            <NoteEditor
              initial={activeSessionNote ?? ""}
              placeholder="Note for this session"
              label={`Note for ${activeExercise?.name ?? "exercise"}`}
              onCommit={(value) => void handleSessionNote(activeId, value)}
              onCancel={() => setEditingNote(null)}
            />
          )}
          {activeEditing === "sticky" && (
            <NoteEditor
              initial={activeStickyNote ?? ""}
              placeholder="Sticky note — stays on this exercise"
              label={`Sticky note for ${activeExercise?.name ?? "exercise"}`}
              onCommit={(value) => {
                void patchExercisePref(activeId, { stickyNote: value });
                setEditingNote(null);
              }}
              onCancel={() => setEditingNote(null)}
            />
          )}
        </div>
      )}

      {activeId && formVideoId === activeId && (
        <FormVideoPanel exerciseId={activeId} open className="pt-1 pb-1" />
      )}

      {!phone ? completeControl : null}

      </div>
      ) : null}

      {phone ? (
        <div className="set-column">
          <div ref={assignDock} className="set-dock" />
          <LoggedSets sets={loggedSets} unit={unit} />
          {completeControl}
        </div>
      ) : null}
    </div>
    </RestClockProvider>
  );
}
