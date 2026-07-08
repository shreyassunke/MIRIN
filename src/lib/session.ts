import { db, type DayTemplate, type WorkoutSession } from "../db/db";
import { move } from "./array";

/** Resolve today's exercise id list (template + extras, or session override). */
export function resolveSessionExerciseIds(
  day: DayTemplate | undefined | null,
  session: WorkoutSession | undefined | null,
): string[] {
  if (session?.sessionExerciseIds?.length) {
    return session.sessionExerciseIds;
  }
  if (day && !day.isRestDay) {
    const extras =
      session?.extraExerciseIds?.filter((id) => !day.exerciseIds.includes(id)) ??
      [];
    return [...day.exerciseIds, ...extras];
  }
  return session?.extraExerciseIds ?? [];
}

/** Snapshot the current derived list into session.sessionExerciseIds. */
export async function ensureSessionExerciseIds(
  sessionId: string,
): Promise<string[]> {
  const session = await db.sessions.get(sessionId);
  if (!session) throw new Error("Session not found");
  if (session.sessionExerciseIds?.length) {
    return session.sessionExerciseIds;
  }
  const day = await db.dayTemplates.get(session.dayTemplateId);
  const ids = resolveSessionExerciseIds(day, session);
  await db.sessions.update(sessionId, { sessionExerciseIds: ids });
  return ids;
}

/** Swap exercise at index; records exerciseSwapOrigins for SetLog audit. */
export async function swapSessionExercise(
  sessionId: string,
  index: number,
  newExerciseId: string,
): Promise<string> {
  const ids = await ensureSessionExerciseIds(sessionId);
  if (index < 0 || index >= ids.length) {
    throw new Error("Invalid exercise index");
  }
  const outgoingId = ids[index];
  if (outgoingId === newExerciseId) return outgoingId;

  const session = await db.sessions.get(sessionId);
  if (!session) throw new Error("Session not found");

  const nextIds = [...ids];
  nextIds[index] = newExerciseId;

  const swapOrigins = { ...(session.exerciseSwapOrigins ?? {}) };
  delete swapOrigins[outgoingId];
  swapOrigins[newExerciseId] = outgoingId;

  await db.sessions.update(sessionId, {
    sessionExerciseIds: nextIds,
    exerciseSwapOrigins: swapOrigins,
  });
  return outgoingId;
}

/** Reorder exercises within a session without affecting logged sets. */
export async function reorderSessionExercises(
  sessionId: string,
  from: number,
  to: number,
): Promise<void> {
  if (from === to) return;
  const ids = await ensureSessionExerciseIds(sessionId);
  if (from < 0 || from >= ids.length || to < 0 || to >= ids.length) return;
  await db.sessions.update(sessionId, {
    sessionExerciseIds: move(ids, from, to),
  });
}

/** Append an ad-hoc exercise to the session list. */
export async function appendSessionExercise(
  sessionId: string,
  exerciseId: string,
): Promise<void> {
  const session = await db.sessions.get(sessionId);
  if (!session) throw new Error("Session not found");

  if (session.sessionExerciseIds?.length) {
    if (session.sessionExerciseIds.includes(exerciseId)) return;
    await db.sessions.update(sessionId, {
      sessionExerciseIds: [...session.sessionExerciseIds, exerciseId],
    });
    return;
  }

  const day = await db.dayTemplates.get(session.dayTemplateId);
  const current = resolveSessionExerciseIds(day, session);
  if (current.includes(exerciseId)) return;

  const extra = session.extraExerciseIds ?? [];
  if (!extra.includes(exerciseId)) {
    await db.sessions.update(sessionId, {
      extraExerciseIds: [...extra, exerciseId],
    });
  }
}
