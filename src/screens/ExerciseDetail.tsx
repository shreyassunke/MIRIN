import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { ExerciseQuote } from "../components/ExerciseQuote";
import { FormVideoButton, FormVideoPanel } from "../components/FormVideo";
import { HeaderBack, PageHeader } from "../components/PageHeader";
import { formClipsFor } from "../lib/formVideos";

export function ExerciseDetail() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  // Keyed by exercise so the panel closes when routing to a different lift.
  const [formOpenFor, setFormOpenFor] = useState<string | null>(() =>
    params.get("form") === "1" ? (id ?? null) : null,
  );
  const formOpen = formOpenFor === id;

  const exercise = useLiveQuery(async () => {
    if (!id) return undefined;
    return (await db.exercises.get(id)) ?? null;
  }, [id]);

  if (exercise === undefined) {
    return <p className="text-sm text-muted">Loading…</p>;
  }
  if (exercise === null) {
    return (
      <div>
        <p className="text-sm text-muted">Exercise not found.</p>
        <Link
          to="/today"
          className="mt-2 inline-block text-sm font-medium text-ink"
        >
          Back to today
        </Link>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={exercise.name}
        subtitle={exercise.muscleGroup}
        back={<HeaderBack to="/today" label="Today" />}
        pill={
          formClipsFor(exercise.id).length > 0 ? (
            <FormVideoButton
              exerciseId={exercise.id}
              open={formOpen}
              onToggle={() => setFormOpenFor(formOpen ? null : (id ?? null))}
            />
          ) : null
        }
      />

      <FormVideoPanel exerciseId={exercise.id} open={formOpen} />

      <ExerciseQuote exerciseId={exercise.id} name={exercise.name} />
    </div>
  );
}
