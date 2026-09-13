import { db, type ExercisePreference, type SetLog } from "../db/db";
import {
  MANUAL_STEP,
  round2,
  toDisplay,
  type Unit,
} from "./units";
import { DEFAULT_REST_SECONDS } from "./workout";

export { DEFAULT_REST_SECONDS };

export const DEFAULT_WARMUP_COUNT = 3;
export const REST_PRESETS = [60, 90, 120, 180] as const;

export function workingSets(logs: SetLog[]): SetLog[] {
  return logs.filter((log) => !log.isWarmup);
}

export function warmupSets(logs: SetLog[]): SetLog[] {
  return logs.filter((log) => log.isWarmup);
}

export function findGroup(
  groups: string[][] | undefined,
  exerciseId: string,
): string[] | undefined {
  return groups?.find((group) => group.includes(exerciseId));
}

export function inSuperset(
  groups: string[][] | undefined,
  exerciseId: string,
): boolean {
  const group = findGroup(groups, exerciseId);
  return (group?.length ?? 0) >= 2;
}

/** Keep group member order aligned with the current exercise list. */
export function orderedGroup(ids: string[], group: string[]): string[] {
  return ids.filter((id) => group.includes(id));
}

/**
 * Consecutive runs that share a superset. A lone member of a group is
 * rendered as a normal row until its partners sit next to it.
 */
export function consecutiveClusters(
  ids: string[],
  groups: string[][] | undefined,
): { ids: string[]; grouped: boolean }[] {
  const result: { ids: string[]; grouped: boolean }[] = [];
  let i = 0;
  while (i < ids.length) {
    const group = findGroup(groups, ids[i]);
    if (!group || group.length < 2) {
      result.push({ ids: [ids[i]], grouped: false });
      i += 1;
      continue;
    }
    const run = [ids[i]];
    i += 1;
    while (i < ids.length && group.includes(ids[i])) {
      run.push(ids[i]);
      i += 1;
    }
    result.push({ ids: run, grouped: run.length > 1 });
  }
  return result;
}

export type GroupPos = "solo" | "first" | "middle" | "last";

export function groupPosFor(
  ids: string[],
  groups: string[][] | undefined,
  exerciseId: string,
): GroupPos {
  const clusters = consecutiveClusters(ids, groups);
  const cluster = clusters.find((c) => c.ids.includes(exerciseId));
  if (!cluster || !cluster.grouped) return "solo";
  const index = cluster.ids.indexOf(exerciseId);
  if (index === 0) return "first";
  if (index === cluster.ids.length - 1) return "last";
  return "middle";
}

function pruneGroups(groups: string[][]): string[][] {
  return groups
    .map((group) => [...new Set(group)])
    .filter((group) => group.length >= 2);
}

export function joinPair(
  groups: string[][] | undefined,
  a: string,
  b: string,
): string[][] {
  if (a === b) return pruneGroups(groups ?? []);
  const current = [...(groups ?? [])];
  const aGroup = current.find((g) => g.includes(a));
  const bGroup = current.find((g) => g.includes(b));
  if (aGroup && aGroup === bGroup) return pruneGroups(current);
  if (aGroup && bGroup) {
    const merged = [...aGroup, ...bGroup.filter((id) => !aGroup.includes(id))];
    return pruneGroups(
      current.filter((g) => g !== aGroup && g !== bGroup).concat([merged]),
    );
  }
  if (aGroup) {
    return pruneGroups(
      current.map((g) => (g === aGroup ? [...g, b] : g)),
    );
  }
  if (bGroup) {
    return pruneGroups(
      current.map((g) => (g === bGroup ? [...g, a] : g)),
    );
  }
  return pruneGroups(current.concat([[a, b]]));
}

/** Pair this slot with the next exercise, or the previous if it is last. */
export function pairWithNeighbor(
  orderedIds: string[],
  groups: string[][] | undefined,
  index: number,
): string[][] {
  if (orderedIds.length < 2) return pruneGroups(groups ?? []);
  const other = index < orderedIds.length - 1 ? index + 1 : index - 1;
  return joinPair(groups, orderedIds[index], orderedIds[other]);
}

export function breakGroup(
  groups: string[][] | undefined,
  exerciseId: string,
): string[][] {
  return pruneGroups(
    (groups ?? []).map((group) => group.filter((id) => id !== exerciseId)),
  );
}

export function remapGroupIds(
  groups: string[][] | undefined,
  from: string,
  to: string,
): string[][] | undefined {
  if (!groups) return groups;
  return pruneGroups(
    groups.map((group) => group.map((id) => (id === from ? to : id))),
  );
}

export function remapRecordKey<T>(
  record: Record<string, T> | undefined,
  from: string,
  to: string,
): Record<string, T> | undefined {
  if (!record || !(from in record) || from === to) return record;
  const next = { ...record };
  next[to] = next[from];
  delete next[from];
  return next;
}

export function omitRecordKey<T>(
  record: Record<string, T> | undefined,
  key: string,
): Record<string, T> | undefined {
  if (!record || !(key in record)) return record;
  const next = { ...record };
  delete next[key];
  return next;
}

export function setRecordValue<T>(
  record: Record<string, T> | undefined,
  key: string,
  value: T | undefined,
): Record<string, T> {
  const next = { ...(record ?? {}) };
  if (value === undefined || value === "") delete next[key];
  else next[key] = value;
  return next;
}

export function formatRest(seconds: number): string {
  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function warmupDisplayWeight(
  workingLb: number,
  warmupIndex: number,
  unit: Unit,
): number {
  const fractions = [0.4, 0.6, 0.8];
  const fraction = fractions[Math.min(warmupIndex, fractions.length - 1)];
  const display = toDisplay(workingLb * fraction, unit);
  const step = MANUAL_STEP[unit];
  return round2(Math.max(step, Math.round(display / step) * step));
}

export async function patchExercisePref(
  exerciseId: string,
  patch: Partial<Omit<ExercisePreference, "exerciseId">>,
): Promise<void> {
  const current = await db.exercisePrefs.get(exerciseId);
  const next: ExercisePreference = {
    ...current,
    ...patch,
    exerciseId,
  };
  if (patch.stickyNote !== undefined && patch.stickyNote.trim() === "") {
    delete next.stickyNote;
  }
  await db.exercisePrefs.put(next);
}
