import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type DayTemplate, type Exercise } from "../db/db";

/**
 * Persist a new exercise order for a day: the template's exerciseIds array
 * is authoritative, and priorityOrder on each exercise is kept in sync so
 * the logging screen's enforced sequence follows.
 */
async function persistOrder(day: DayTemplate, orderedIds: string[]) {
  await db.transaction("rw", db.dayTemplates, db.exercises, async () => {
    await db.dayTemplates.update(day.id, { exerciseIds: orderedIds });
    await Promise.all(
      orderedIds.map((exerciseId, index) =>
        db.exercises.update(exerciseId, { priorityOrder: index + 1 }),
      ),
    );
  });
}

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

interface DayCardProps {
  day: DayTemplate;
  exercises: Map<string, Exercise>;
}

function DayCard({ day, exercises }: DayCardProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const reorder = (from: number, to: number) => {
    if (from === to || to < 0 || to >= day.exerciseIds.length) return;
    void persistOrder(day, move(day.exerciseIds, from, to));
  };

  return (
    <section>
      <h2 className="mb-2 text-[15px] font-semibold tracking-tight">
        {day.name}
      </h2>
      <ol className="divide-y divide-hairline rounded-md border border-hairline bg-surface">
        {day.exerciseIds.map((exerciseId, index) => {
          const exercise = exercises.get(exerciseId);
          if (!exercise) return null;
          const isDragTarget = overIndex === index && dragIndex !== null;
          return (
            <li
              key={exerciseId}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setOverIndex(index);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null) reorder(dragIndex, index);
                setDragIndex(null);
                setOverIndex(null);
              }}
              className={[
                "flex items-center gap-3 px-4 py-2.5",
                dragIndex === index ? "opacity-50" : "",
                isDragTarget ? "bg-surface-raised" : "",
              ].join(" ")}
            >
              <span
                aria-hidden="true"
                className="cursor-grab select-none text-muted"
              >
                ⠿
              </span>
              <span className="tnum w-5 shrink-0 text-[13px] text-muted">
                {index + 1}
              </span>
              <span className="flex-1 text-sm font-medium">
                {exercise.name}
              </span>
              <span className="hidden text-[13px] text-muted sm:inline">
                {exercise.muscleGroup}
              </span>
              <span className="flex gap-1">
                <button
                  type="button"
                  aria-label={`Move ${exercise.name} up`}
                  disabled={index === 0}
                  onClick={() => reorder(index, index - 1)}
                  className="h-11 w-11 rounded-md border border-hairline bg-surface text-muted transition-colors duration-150 hover:bg-surface-raised hover:text-ink disabled:pointer-events-none disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Move ${exercise.name} down`}
                  disabled={index === day.exerciseIds.length - 1}
                  onClick={() => reorder(index, index + 1)}
                  className="h-11 w-11 rounded-md border border-hairline bg-surface text-muted transition-colors duration-150 hover:bg-surface-raised hover:text-ink disabled:pointer-events-none disabled:opacity-40"
                >
                  ↓
                </button>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function SplitEditor() {
  const data = useLiveQuery(async () => {
    const split = await db.splits.toCollection().first();
    if (!split) return undefined;
    const days = (await db.dayTemplates.bulkGet(split.dayTemplateIds)).filter(
      (d): d is DayTemplate => d !== undefined,
    );
    const exercises = new Map(
      (await db.exercises.toArray()).map((e) => [e.id, e] as const),
    );
    return { split, days, exercises };
  }, []);

  if (!data) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Split</h1>
        <p className="mt-1 max-w-[65ch] text-sm leading-relaxed text-muted">
          Drag to reorder, or use the arrows. Order here is the order enforced
          on the Today screen.
        </p>
      </header>
      <div className="space-y-8">
        {data.days.map((day) => (
          <DayCard key={day.id} day={day} exercises={data.exercises} />
        ))}
      </div>
    </div>
  );
}
