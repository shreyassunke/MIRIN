import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { ExerciseQuote } from "../components/ExerciseQuote";
import { FormVideoButton, FormVideoPanel } from "../components/FormVideo";
import { Chevron } from "./profile/chrome";

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
      <nav className="mb-4">
        <Link
          to="/today"
          className="glass-btn inline-flex h-11 items-center gap-1 rounded-pill pl-2.5 pr-3.5 text-sm font-medium text-ink"
          aria-label="Back to today"
        >
          <Chevron direction="left" />
          Today
        </Link>
      </nav>
      <header className="mb-5">
        {/* The help control belongs to the lift, so it rides the name line. */}
        <div className="flex items-center justify-between gap-4">
          <h1 className="min-w-0 text-2xl font-semibold tracking-tight">
            {exercise.name}
          </h1>
          <FormVideoButton
            exerciseId={exercise.id}
            open={formOpen}
            onToggle={() => setFormOpenFor(formOpen ? null : (id ?? null))}
          />
        </div>
        <p className="mt-0.5 text-sm text-muted">{exercise.muscleGroup}</p>
      </header>

      <FormVideoPanel exerciseId={exercise.id} open={formOpen} />

      <ExerciseQuote exerciseId={exercise.id} name={exercise.name} />
    </div>
  );
}
