import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type DayTemplate, type Exercise, type Split } from "../db/db";
import {
  activateSplit,
  addDay,
  canDeactivateSplit,
  createSplit,
  deleteSplit,
  duplicateSplit,
  removeDaySlot,
  renameDay,
  reorderRotation,
  setRotationToday,
  REST_DAY_TEMPLATE,
} from "../lib/splits";
import { rotationIndexForDate, weekdayLabels } from "../lib/rotation";
import { ensureExerciseRow, type ExerciseLibraryEntry } from "../lib/library";
import { move } from "../lib/array";
import { ExerciseCombobox } from "../components/ExerciseCombobox";
import { DragHandle } from "../components/DragHandle";
import { ToggleSwitch } from "../components/ToggleSwitch";
import { useDragReorder } from "../hooks/useDragReorder";

const iconBtn =
  "h-11 w-11 rounded-md border border-hairline bg-surface text-muted transition-colors duration-150 hover:bg-surface-raised hover:text-ink disabled:pointer-events-none disabled:opacity-40";
const secondaryBtn =
  "h-11 rounded-md border border-hairline bg-surface px-4 text-sm font-medium text-ink transition-colors duration-150 hover:bg-surface-raised";

/** Two-tap destructive action: no modal, no accidental taps. */
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
      className={secondaryBtn}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}

interface RotationEditorProps {
  split: Split;
  dayNames: Map<string, string>;
}

function RotationEditor({ split, dayNames }: RotationEditorProps) {
  const reorder = (from: number, to: number) => {
    void reorderRotation(split, from, to);
  };
  const { getItemProps, getHandleProps } = useDragReorder({
    enabled: split.dayTemplateIds.length > 1,
    handleOnly: true,
    onReorder: reorder,
  });

  const labels = weekdayLabels(split);
  const todayIndex = split.isActive ? rotationIndexForDate(split) : null;

  return (
    <section>
      <h3 className="mb-2 text-[15px] font-semibold tracking-tight">
        Rotation
      </h3>
      <p className="mb-3 max-w-[65ch] text-[13px] leading-relaxed text-muted">
        {labels
          ? "One slot per calendar day, repeating weekly."
          : split.dayTemplateIds.length === 1
            ? "The same day, every calendar day."
            : `Repeats every ${split.dayTemplateIds.length} days, one slot per calendar day.`}{" "}
        Drag the handle to reorder.
      </p>
      <ol className="divide-y divide-hairline rounded-md border border-hairline bg-surface">
        {split.dayTemplateIds.map((dayTemplateId, index) => {
          const dragProps = getItemProps(index);
          const handleProps = getHandleProps(index);
          const isRest = dayTemplateId === REST_DAY_TEMPLATE.id;
          const isToday = todayIndex === index;
          return (
            <li
              key={`${index}-${dayTemplateId}`}
              {...dragProps}
              className={["flex items-center gap-2 px-2 py-1.5", dragProps.className]
                .filter(Boolean)
                .join(" ")}
            >
              <DragHandle
                onPointerDown={handleProps.onPointerDown}
                onPointerMove={handleProps.onPointerMove}
                onPointerUp={handleProps.onPointerUp}
                onPointerCancel={handleProps.onPointerCancel}
              />
              <span className="tnum w-12 shrink-0 text-[13px] text-muted">
                {labels ? labels[index] : index + 1}
              </span>
              <span
                className={[
                  "min-w-0 flex-1 px-1 text-sm",
                  isRest ? "text-muted" : "font-medium text-ink",
                ].join(" ")}
              >
                {dayNames.get(dayTemplateId) ?? dayTemplateId}
                {isToday && (
                  <span className="ml-2 text-[13px] text-muted">· Today</span>
                )}
              </span>
              {split.isActive && !split.isDefault && !isToday && (
                <button
                  type="button"
                  onClick={() => void setRotationToday(split.id, index)}
                  className="shrink-0 px-2 text-[13px] font-medium text-muted transition-colors duration-150 hover:text-ink"
                >
                  Set as today
                </button>
              )}
              <button
                type="button"
                aria-label={`Remove slot ${index + 1}`}
                disabled={split.dayTemplateIds.length <= 1}
                onClick={() => void removeDaySlot(split, index)}
                className={iconBtn}
              >
                ×
              </button>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => void addDay(split)}
          className={secondaryBtn}
        >
          Add day
        </button>
        <button
          type="button"
          onClick={() => void addDay(split, { rest: true })}
          className={secondaryBtn}
        >
          Add rest day
        </button>
      </div>
    </section>
  );
}

interface DayCardProps {
  day: DayTemplate;
  exercises: Map<string, Exercise>;
}

function DayCard({ day, exercises }: DayCardProps) {
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(day.name);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [swappingIndex, setSwappingIndex] = useState<number | null>(null);

  useEffect(() => {
    setNameDraft(day.name);
    setRenaming(false);
  }, [day.id, day.name]);

  const reorder = (from: number, to: number) => {
    if (from === to || to < 0 || to >= day.exerciseIds.length) return;
    void db.dayTemplates.update(day.id, {
      exerciseIds: move(day.exerciseIds, from, to),
    });
  };
  const { getItemProps, getHandleProps } = useDragReorder({
    enabled: day.exerciseIds.length > 1,
    handleOnly: true,
    onReorder: reorder,
  });

  const removeExercise = (exerciseId: string) => {
    void db.dayTemplates.update(day.id, {
      exerciseIds: day.exerciseIds.filter((id) => id !== exerciseId),
    });
    if (focusedId === exerciseId) setFocusedId(null);
    setSwappingIndex(null);
  };

  const swapExercise = async (index: number, entry: ExerciseLibraryEntry) => {
    const newId = await ensureExerciseRow(entry);
    const current = await db.dayTemplates.get(day.id);
    if (!current) return;
    if (current.exerciseIds.includes(newId) && current.exerciseIds[index] !== newId) {
      return;
    }
    const next = [...current.exerciseIds];
    next[index] = newId;
    await db.dayTemplates.update(day.id, { exerciseIds: next });
    setSwappingIndex(null);
    setFocusedId(newId);
  };

  const commitRename = () => {
    setRenaming(false);
    if (nameDraft.trim() && nameDraft.trim() !== day.name) {
      void renameDay(day, nameDraft);
    } else {
      setNameDraft(day.name);
    }
  };

  return (
    <section>
      <div className="mb-2">
        {renaming ? (
          <input
            type="text"
            value={nameDraft}
            autoFocus
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setNameDraft(day.name);
                setRenaming(false);
              }
            }}
            aria-label="Day name"
            className="h-9 w-full max-w-xs rounded-md border border-hairline bg-bg px-2 text-[15px] font-semibold text-ink focus:border-muted"
          />
        ) : (
          <button
            type="button"
            onClick={() => setRenaming(true)}
            className="rounded-md text-left transition-colors duration-150 hover:text-muted"
            aria-label={`Rename ${day.name}`}
          >
            <h3 className="text-[15px] font-semibold tracking-tight">
              {day.name}
            </h3>
          </button>
        )}
      </div>

      {day.exerciseIds.length === 0 ? (
        <p className="rounded-md border border-hairline bg-surface px-4 py-3 text-sm text-muted">
          No exercises yet — add the first one below.
        </p>
      ) : (
        <ul className="space-y-2">
          {day.exerciseIds.map((exerciseId, index) => {
            const exercise = exercises.get(exerciseId);
            if (!exercise) return null;
            const dragProps = getItemProps(index);
            const handleProps = getHandleProps(index);
            const isFocused = focusedId === exerciseId;
            const isSwapping = swappingIndex === index;
            return (
              <li
                key={exerciseId}
                {...dragProps}
                className={[
                  "rounded-md border border-hairline bg-surface",
                  dragProps.className,
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className="flex items-stretch gap-2 px-2 py-2">
                  <div className="flex shrink-0 items-center self-center">
                    <DragHandle
                      onPointerDown={handleProps.onPointerDown}
                      onPointerMove={handleProps.onPointerMove}
                      onPointerUp={handleProps.onPointerUp}
                      onPointerCancel={handleProps.onPointerCancel}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (isSwapping) return;
                      if (isFocused) {
                        setSwappingIndex(index);
                      } else {
                        setFocusedId(exerciseId);
                        setSwappingIndex(null);
                      }
                    }}
                    className={[
                      "flex min-w-0 flex-1 items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-left transition-colors duration-150 motion-reduce:transition-none",
                      isFocused
                        ? "bg-surface-raised/50"
                        : "hover:bg-surface-raised/30",
                    ].join(" ")}
                    aria-expanded={isSwapping}
                    aria-label={`Replace ${exercise.name}`}
                  >
                    <span className="min-w-0">
                      <span className="block text-[17px] font-semibold tracking-tight">
                        {exercise.name}
                      </span>
                      <span className="mt-0.5 block text-[13px] text-muted">
                        {exercise.muscleGroup}
                      </span>
                    </span>
                    <span className="tnum shrink-0 text-[13px] text-muted">
                      {index + 1}
                    </span>
                  </button>
                  {isFocused && (
                    <button
                      type="button"
                      aria-label={`Remove ${exercise.name} from ${day.name}`}
                      onClick={() => removeExercise(exerciseId)}
                      className={`${iconBtn} self-center`}
                    >
                      ×
                    </button>
                  )}
                </div>

                {isSwapping && (
                  <div className="border-t border-hairline px-4 py-3">
                    <ExerciseCombobox
                      label="Replace with…"
                      excludeIds={day.exerciseIds.filter((id) => id !== exerciseId)}
                      placeholder="Search exercises"
                      onCancel={() => setSwappingIndex(null)}
                      onPick={(entry) => void swapExercise(index, entry)}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-2">
        {adding ? (
          <ExerciseCombobox
            excludeIds={day.exerciseIds}
            onCancel={() => setAdding(false)}
            onPick={async (entry) => {
              const id = await ensureExerciseRow(entry);
              const current = await db.dayTemplates.get(day.id);
              if (!current || current.exerciseIds.includes(id)) return;
              await db.dayTemplates.update(day.id, {
                exerciseIds: [...current.exerciseIds, id],
              });
              setFocusedId(id);
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-[13px] font-medium text-muted transition-colors duration-150 hover:text-ink"
          >
            Add exercise
          </button>
        )}
      </div>
    </section>
  );
}

interface SplitDetailProps {
  split: Split;
  days: Map<string, DayTemplate>;
  exercises: Map<string, Exercise>;
  onDeleted: () => void;
  onDuplicated: (id: string) => void;
}

function SplitDetail({
  split,
  days,
  exercises,
  onDeleted,
  onDuplicated,
}: SplitDetailProps) {
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(split.name);

  useEffect(() => {
    setRenaming(false);
    setNameDraft(split.name);
  }, [split.id, split.name]);

  const dayNames = new Map(
    [...days.values()].map((d) => [d.id, d.name] as const),
  );

  // Each unique workout template once, in rotation order.
  const uniqueDays: DayTemplate[] = [];
  const seen = new Set<string>();
  for (const id of split.dayTemplateIds) {
    if (seen.has(id) || id === REST_DAY_TEMPLATE.id) continue;
    seen.add(id);
    const day = days.get(id);
    if (day && !day.isRestDay) uniqueDays.push(day);
  }

  const commitRename = () => {
    setRenaming(false);
    if (nameDraft.trim() && nameDraft.trim() !== split.name) {
      void db.splits.update(split.id, { name: nameDraft.trim() });
    } else {
      setNameDraft(split.name);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {renaming ? (
            <input
              type="text"
              value={nameDraft}
              autoFocus
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") {
                  setNameDraft(split.name);
                  setRenaming(false);
                }
              }}
              aria-label="Split name"
              className="h-9 rounded-md border border-hairline bg-bg px-2 text-lg font-semibold text-ink focus:border-muted"
            />
          ) : (
            <button
              type="button"
              onClick={() => setRenaming(true)}
              className="rounded-md text-left transition-colors duration-150 hover:text-muted"
              aria-label={`Rename ${split.name}`}
            >
              <h2 className="text-lg font-semibold tracking-tight">
                {split.name}
              </h2>
            </button>
          )}
          <p className="mt-0.5 text-[13px] text-muted">
            {split.isDefault
              ? "Default split"
              : split.isActive
                ? "Active split"
                : "Custom split"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={async () => onDuplicated(await duplicateSplit(split))}
            className={secondaryBtn}
          >
            Duplicate
          </button>
          {!split.isDefault && (
            <ConfirmButton
              label="Delete"
              confirmLabel="Delete split?"
              onConfirm={async () => {
                await deleteSplit(split);
                onDeleted();
              }}
            />
          )}
        </div>
      </div>

      <RotationEditor split={split} dayNames={dayNames} />

      {uniqueDays.map((day) => (
        <DayCard key={day.id} day={day} exercises={exercises} />
      ))}
    </div>
  );
}

export function SplitEditor() {
  const data = useLiveQuery(async () => {
    const splits = await db.splits.toArray();
    // Default first, then by name.
    splits.sort((a, b) =>
      a.isDefault === b.isDefault
        ? a.name.localeCompare(b.name)
        : a.isDefault
          ? -1
          : 1,
    );
    const days = new Map(
      (await db.dayTemplates.toArray()).map((d) => [d.id, d] as const),
    );
    const exercises = new Map(
      (await db.exercises.toArray()).map((e) => [e.id, e] as const),
    );
    return { splits, days, exercises };
  }, []);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [blockedSplitId, setBlockedSplitId] = useState<string | null>(null);

  useEffect(() => {
    if (!blockedSplitId) return;
    const t = setTimeout(() => setBlockedSplitId(null), 3000);
    return () => clearTimeout(t);
  }, [blockedSplitId]);

  if (!data) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  const selected =
    data.splits.find((s) => s.id === selectedId) ??
    data.splits.find((s) => s.isActive) ??
    data.splits[0];

  const workoutDayCount = (split: Split) =>
    split.dayTemplateIds.filter((id) => {
      const day = data.days.get(id);
      return day && !day.isRestDay;
    }).length;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Split</h1>
        <p className="mt-1 max-w-[65ch] text-sm leading-relaxed text-muted">
          The active split drives the Today screen. Switching splits never
          touches logged history.
        </p>
      </header>

      <section className="mb-8">
        <ul className="divide-y divide-hairline rounded-md border border-hairline bg-surface">
          {data.splits.map((split) => {
            const isSelected = split.id === selected?.id;
            return (
              <li key={split.id} className="flex items-center gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setSelectedId(split.id)}
                  className="min-w-0 flex-1 text-left"
                  aria-current={isSelected ? "true" : undefined}
                >
                  <span
                    className={[
                      "block truncate text-sm font-semibold",
                      isSelected ? "text-ink" : "text-muted",
                    ].join(" ")}
                  >
                    {split.name}
                    {split.isDefault && split.isActive && (
                      <span className="ml-2 font-medium text-muted">
                        Current split — default
                      </span>
                    )}
                    {split.isDefault && !split.isActive && (
                      <span className="ml-2 font-medium text-muted">
                        Default
                      </span>
                    )}
                  </span>
                  <span className="tnum mt-0.5 block text-[13px] text-muted">
                    {workoutDayCount(split)} workout{" "}
                    {workoutDayCount(split) === 1 ? "day" : "days"} ·{" "}
                    {split.dayTemplateIds.length}-day rotation
                  </span>
                </button>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <ToggleSwitch
                    checked={split.isActive}
                    label={`${split.name} active`}
                    onChange={(next) => {
                      if (next) {
                        void activateSplit(split.id);
                        return;
                      }
                      void (async () => {
                        if (!(await canDeactivateSplit(split.id))) {
                          setBlockedSplitId(split.id);
                        }
                      })();
                    }}
                  />
                  {blockedSplitId === split.id && (
                    <span className="text-[12px] text-muted">
                      Activate another split first
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-3">
          {creating ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const id = await createSplit(newName);
                setCreating(false);
                setNewName("");
                setSelectedId(id);
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={newName}
                autoFocus
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setCreating(false);
                }}
                placeholder="Split name"
                aria-label="New split name"
                className="h-11 flex-1 rounded-md border border-hairline bg-bg px-3 text-sm text-ink placeholder:text-muted focus:border-muted"
              />
              <button
                type="submit"
                disabled={!newName.trim()}
                className="h-11 rounded-md bg-accent px-4 text-sm font-semibold text-bg transition-colors duration-150 hover:bg-ink disabled:bg-surface disabled:text-muted"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setCreating(false)}
                className={secondaryBtn}
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className={secondaryBtn}
            >
              Create new split
            </button>
          )}
        </div>
      </section>

      {selected && (
        <SplitDetail
          split={selected}
          days={data.days}
          exercises={data.exercises}
          onDeleted={() => setSelectedId(null)}
          onDuplicated={(id) => setSelectedId(id)}
        />
      )}
    </div>
  );
}
