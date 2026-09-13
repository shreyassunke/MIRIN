import { db, type DayTemplate, type WorkoutSession } from "../db/db";
import { move } from "./array";
import {
  breakGroup,
  omitRecordKey,
  pairWithNeighbor,
  remapGroupIds,
  remapRecordKey,
  setRecordValue,
} from "./exerciseMeta";

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

  const finished = session.finishedExerciseIds ?? [];
  await db.sessions.update(sessionId, {
    sessionExerciseIds: nextIds,
    exerciseSwapOrigins: swapOrigins,
    supersets: remapGroupIds(session.supersets, outgoingId, newExerciseId),
    warmupTargets: remapRecordKey(
      session.warmupTargets,
      outgoingId,
      newExerciseId,
    ),
    exerciseNotes: remapRecordKey(
      session.exerciseNotes,
      outgoingId,
      newExerciseId,
    ),
    finishedExerciseIds: finished.map((id) =>
      id === outgoingId ? newExerciseId : id,
    ),
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

/** Mark an exercise done, or reopen it. Set counts are the user's to choose. */
export async function setExerciseFinished(
  sessionId: string,
  exerciseId: string,
  finished: boolean,
): Promise<void> {
  const session = await db.sessions.get(sessionId);
  if (!session) throw new Error("Session not found");
  const current = session.finishedExerciseIds ?? [];
  if (current.includes(exerciseId) === finished) return;
  await db.sessions.update(sessionId, {
    finishedExerciseIds: finished
      ? [...current, exerciseId]
      : current.filter((id) => id !== exerciseId),
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

/** Drop an exercise from today's list. Logged sets stay in history. */
export async function removeSessionExercise(
  sessionId: string,
  exerciseId: string,
  opts: { deleteLogs?: boolean } = {},
): Promise<void> {
  const ids = await ensureSessionExerciseIds(sessionId);
  const session = await db.sessions.get(sessionId);
  if (!session) throw new Error("Session not found");

  await db.sessions.update(sessionId, {
    sessionExerciseIds: ids.filter((id) => id !== exerciseId),
    extraExerciseIds: (session.extraExerciseIds ?? []).filter(
      (id) => id !== exerciseId,
    ),
    supersets: breakGroup(session.supersets, exerciseId),
    warmupTargets: omitRecordKey(session.warmupTargets, exerciseId),
    exerciseNotes: omitRecordKey(session.exerciseNotes, exerciseId),
    finishedExerciseIds: (session.finishedExerciseIds ?? []).filter(
      (id) => id !== exerciseId,
    ),
  });

  if (opts.deleteLogs) {
    const logs = await db.setLogs.where("sessionId").equals(sessionId).toArray();
    const ids = logs
      .filter((log) => log.exerciseId === exerciseId)
      .map((log) => log.id);
    if (ids.length > 0) await db.setLogs.bulkDelete(ids);
  }
}

export function resolveSessionSupersets(
  day: DayTemplate | undefined | null,
  session: WorkoutSession | undefined | null,
): string[][] {
  return session?.supersets ?? day?.supersets ?? [];
}

export function resolveSessionWarmupTargets(
  day: DayTemplate | undefined | null,
  session: WorkoutSession | undefined | null,
): Record<string, number> {
  return session?.warmupTargets ?? day?.warmupTargets ?? {};
}

export async function setSessionNote(
  sessionId: string,
  exerciseId: string,
  note: string,
): Promise<void> {
  const session = await db.sessions.get(sessionId);
  if (!session) throw new Error("Session not found");
  await db.sessions.update(sessionId, {
    exerciseNotes: setRecordValue(session.exerciseNotes, exerciseId, note.trim()),
  });
}

export async function toggleSessionSuperset(
  sessionId: string,
  index: number,
): Promise<void> {
  const ids = await ensureSessionExerciseIds(sessionId);
  const session = await db.sessions.get(sessionId);
  if (!session) throw new Error("Session not found");
  const day = await db.dayTemplates.get(session.dayTemplateId);
  const current = resolveSessionSupersets(day, session);
  const exerciseId = ids[index];
  if (!exerciseId) return;
  const grouped = current.some((g) => g.includes(exerciseId) && g.length >= 2);
  await db.sessions.update(sessionId, {
    supersets: grouped
      ? breakGroup(current, exerciseId)
      : pairWithNeighbor(ids, current, index),
  });
}

export async function setSessionWarmupTarget(
  sessionId: string,
  exerciseId: string,
  count: number,
): Promise<void> {
  const session = await db.sessions.get(sessionId);
  if (!session) throw new Error("Session not found");
  const day = await db.dayTemplates.get(session.dayTemplateId);
  const current = resolveSessionWarmupTargets(day, session);
  await db.sessions.update(sessionId, {
    warmupTargets: setRecordValue(
      current,
      exerciseId,
      count > 0 ? count : undefined,
    ),
  });
}
