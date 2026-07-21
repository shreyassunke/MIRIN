import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type SetLog } from "../db/db";
import {
  addSetToSession,
  deleteSetLog,
  formatDayHeading,
  sessionDateKey,
  updateSetLog,
} from "../lib/history";
import { formatWeight } from "../lib/workout";
import {
  appendSessionExercise,
  resolveSessionExerciseIds,
} from "../lib/session";
import { MANUAL_STEP, toCanonical, toDisplay } from "../lib/units";
import { useUnit } from "../lib/settings";
import { ensureExerciseRow, type ExerciseLibraryEntry } from "../lib/library";
import { ExerciseCombobox } from "../components/ExerciseCombobox";
import { Stepper } from "../components/Stepper";

const secondaryBtn =
  "glass-btn h-11 rounded-pill px-4 text-sm font-medium text-ink";

function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
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
      {armed ? confirmLabel : label}
    </button>
  );
}

export function SessionDetail() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [unit] = useUnit();
  const [addingExercise, setAddingExercise] = useState(false);
  const [addingSetFor, setAddingSetFor] = useState<string | null>(null);
  const [newWeight, setNewWeight] = useState(45);
  const [newReps, setNewReps] = useState(8);

  const data = useLiveQuery(async () => {
    if (!sessionId) return null;
    const session = await db.sessions.get(sessionId);
    if (!session) return null;
    const [day, logs, exercises] = await Promise.all([
      db.dayTemplates.get(session.dayTemplateId),
      db.setLogs.where("sessionId").equals(sessionId).toArray(),
      db.exercises.toArray(),
    ]);
    const exerciseIds = resolveSessionExerciseIds(day, session);
    const loggedIds = [...new Set(logs.map((l) => l.exerciseId))];
    const orderedIds = [
      ...exerciseIds,
      ...loggedIds.filter((id) => !exerciseIds.includes(id)),
    ];
    const byId = new Map(exercises.map((e) => [e.id, e] as const));
    const logsByExercise = new Map<string, SetLog[]>();
    for (const log of logs) {
      const list = logsByExercise.get(log.exerciseId) ?? [];
      list.push(log);
      logsByExercise.set(log.exerciseId, list);
    }
    for (const list of logsByExercise.values()) {
      list.sort((a, b) => a.setNumber - b.setNumber);
    }
    return {
      session,
      dayName: day?.name ?? "Session",
      dateKey: sessionDateKey(session),
      exercises: orderedIds
        .map((id) => byId.get(id))
        .filter((e): e is NonNullable<typeof e> => e !== undefined),
      logsByExercise,
      excludeIds: orderedIds,
    };
  }, [sessionId]);

  const dayLink = useMemo(() => {
    if (!data) return "/history";
    return `/history?day=${data.dateKey}`;
  }, [data]);

  if (data === undefined) {
    return <p className="text-sm text-muted">Loading…</p>;
  }
  if (data === null || !sessionId) {
    return (
      <div>
        <p className="text-sm text-muted">Session not found.</p>
        <Link
          to="/history"
          className="mt-2 inline-block text-sm font-medium text-ink"
        >
          Back to history
        </Link>
      </div>
    );
  }

  const startAddSet = (exerciseId: string) => {
    const existing = data.logsByExercise.get(exerciseId) ?? [];
    const last = existing[existing.length - 1];
    setAddingSetFor(exerciseId);
    setNewWeight(
      last ? toDisplay(last.weight, unit) : unit === "lb" ? 45 : 20,
    );
    setNewReps(last?.reps ?? 8);
  };

  const saveNewSet = async () => {
    if (!addingSetFor) return;
    await addSetToSession({
      sessionId,
      exerciseId: addingSetFor,
      weightDisplay: newWeight,
      reps: newReps,
      unit,
    });
    setAddingSetFor(null);
  };

  const onAddExercise = async (entry: ExerciseLibraryEntry) => {
    await ensureExerciseRow(entry);
    await appendSessionExercise(sessionId, entry.id);
    setAddingExercise(false);
    startAddSet(entry.id);
  };

  const deleteSession = async () => {
    const logs = await db.setLogs.where("sessionId").equals(sessionId).toArray();
    await Promise.all(logs.map((l) => db.setLogs.delete(l.id)));
    await db.sessions.delete(sessionId);
    navigate(dayLink, { replace: true });
  };

  return (
    <div>
      <header className="mb-6">
        <Link
          to={dayLink}
          className="text-[13px] font-medium text-muted transition-colors duration-150 hover:text-ink"
        >
          History
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {data.dayName}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {formatDayHeading(data.dateKey)}
          {data.session.completed ? " · completed" : " · in progress"}
        </p>
      </header>

      <p className="mb-6 max-w-[65ch] text-sm leading-relaxed text-muted">
        Tap a value to correct it. Changes save immediately.
      </p>

      {data.exercises.length === 0 ? (
        <p className="mb-6 max-w-[65ch] text-sm leading-relaxed text-muted">
          No exercises on this session.
        </p>
      ) : (
        <div className="space-y-6">
          {data.exercises.map((exercise) => {
            const sets = data.logsByExercise.get(exercise.id) ?? [];
            return (
              <section
                key={exercise.id}
                className="rounded-xl glass p-4 shadow-glass"
              >
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h2 className="text-[15px] font-semibold tracking-tight">
                    {exercise.name}
                  </h2>
                  <button
                    type="button"
                    className="text-[13px] font-medium text-muted transition-colors duration-150 hover:text-ink"
                    onClick={() => startAddSet(exercise.id)}
                  >
                    Add set
                  </button>
                </div>

                {sets.length === 0 ? (
                  <p className="text-[13px] text-muted">No sets logged.</p>
                ) : (
                  <ul className="space-y-4">
                    {sets.map((set) => (
                      <SetEditor
                        key={set.id}
                        set={set}
                        unit={unit}
                        onDelete={() => void deleteSetLog(set.id)}
                      />
                    ))}
                  </ul>
                )}

                {addingSetFor === exercise.id ? (
                  <div className="mt-4 space-y-3 border-t border-hairline pt-4">
                    <div className="flex flex-wrap justify-center gap-6">
                      <Stepper
                        label={`Weight (${unit})`}
                        value={newWeight}
                        step={MANUAL_STEP[unit]}
                        min={0}
                        onChange={setNewWeight}
                      />
                      <Stepper
                        label="Reps"
                        value={newReps}
                        step={1}
                        min={1}
                        onChange={setNewReps}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-primary h-11 rounded-pill bg-accent px-5 text-sm font-medium text-bg hover:bg-ink"
                        onClick={() => void saveNewSet()}
                      >
                        Log set
                      </button>
                      <button
                        type="button"
                        className={secondaryBtn}
                        onClick={() => setAddingSetFor(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}

      <div className="mt-8 space-y-4">
        {addingExercise ? (
          <ExerciseCombobox
            label="Add exercise"
            placeholder="Search exercises"
            autoFocus
            excludeIds={data.excludeIds}
            onPick={(entry) => void onAddExercise(entry)}
            onCancel={() => setAddingExercise(false)}
          />
        ) : (
          <button
            type="button"
            className={secondaryBtn}
            onClick={() => setAddingExercise(true)}
          >
            Add exercise
          </button>
        )}

        <div>
          <ConfirmButton
            label="Delete session"
            confirmLabel="Confirm delete"
            onConfirm={() => void deleteSession()}
          />
        </div>
      </div>
    </div>
  );
}

function SetEditor({
  set,
  unit,
  onDelete,
}: {
  set: SetLog;
  unit: "lb" | "kg";
  onDelete: () => void;
}) {
  const weightDisplay = toDisplay(set.weight, unit);
  const step = MANUAL_STEP[unit];

  return (
    <li className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="tnum shrink-0 text-[13px] font-medium text-muted">
        Set {set.setNumber}
      </span>
      <div className="flex flex-wrap items-center gap-4">
        <MiniStepper
          label={unit}
          value={weightDisplay}
          step={step}
          min={0}
          onChange={(v) =>
            void updateSetLog(set.id, { weight: toCanonical(v, unit) })
          }
        />
        <MiniStepper
          label="reps"
          value={set.reps}
          step={1}
          min={1}
          onChange={(v) => void updateSetLog(set.id, { reps: v })}
        />
        <ConfirmButton
          label="Delete"
          confirmLabel="Confirm"
          onConfirm={onDelete}
        />
      </div>
    </li>
  );
}

/** Compact stepper for correcting a logged set inline. */
function MiniStepper({
  label,
  value,
  step,
  min,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  min: number;
  onChange: (value: number) => void;
}) {
  const btn =
    "glass-btn flex h-11 w-11 items-center justify-center rounded-pill text-lg leading-none text-ink";
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        className={btn}
        aria-label={`Decrease ${label}`}
        onClick={() => onChange(Math.max(min, value - step))}
      >
        &minus;
      </button>
      <span className="tnum min-w-14 text-center text-base font-semibold tracking-tight">
        {formatWeight(value)}
        <span className="ml-1 text-[12px] font-medium text-muted">{label}</span>
      </span>
      <button
        type="button"
        className={btn}
        aria-label={`Increase ${label}`}
        onClick={() => onChange(value + step)}
      >
        +
      </button>
    </div>
  );
}
