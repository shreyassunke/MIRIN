import { db, type DayTemplate, type Split } from "../db/db";
import { REST_DAY_TEMPLATE } from "../db/seed";
import { toLocalISODate } from "./rotation";
import { newId } from "./workout";

export { REST_DAY_TEMPLATE };

/**
 * Makes a split the active one (drives the Today screen). Custom splits
 * re-anchor so today lands on their first rotation slot; the default split
 * keeps its Monday anchor, preserving the original weekday alignment.
 */
export async function activateSplit(id: string) {
  await db.transaction("rw", db.splits, async () => {
    const target = await db.splits.get(id);
    if (!target) return;
    await db.splits.toCollection().modify((s: Split) => {
      s.isActive = s.id === id;
    });
    if (!target.isDefault) {
      await db.splits.update(id, {
        anchorDate: toLocalISODate(new Date()),
        anchorIndex: 0,
      });
    }
  });
}

/** Returns false if deactivating would leave zero active splits. */
export async function canDeactivateSplit(id: string): Promise<boolean> {
  const split = await db.splits.get(id);
  if (!split?.isActive) return true;
  const all = await db.splits.toArray();
  if (all.length <= 1) return false;
  const otherActive = all.some((s) => s.id !== id && s.isActive);
  return otherActive;
}

/** Re-pins the rotation so the slot at `index` is today's workout. */
export async function setRotationToday(splitId: string, index: number) {
  await db.splits.update(splitId, {
    anchorDate: toLocalISODate(new Date()),
    anchorIndex: index,
  });
}

/** New empty split with one blank day, not active until switched to. */
export async function createSplit(name: string): Promise<string> {
  const splitId = newId();
  const dayId = newId();
  await db.transaction("rw", db.splits, db.dayTemplates, async () => {
    await db.dayTemplates.add({ id: dayId, name: "Day 1", exerciseIds: [] });
    await db.splits.add({
      id: splitId,
      name: name.trim() || "New split",
      dayTemplateIds: [dayId],
      isActive: false,
      anchorDate: toLocalISODate(new Date()),
      anchorIndex: 0,
    });
  });
  return splitId;
}

/**
 * Deep-copies a split: day templates are cloned (the shared rest template
 * excepted) so edits to the copy never touch the original.
 */
export async function duplicateSplit(split: Split): Promise<string> {
  const copyId = newId();
  await db.transaction("rw", db.splits, db.dayTemplates, async () => {
    const idMap = new Map<string, string>();
    for (const dayId of new Set(split.dayTemplateIds)) {
      if (dayId === REST_DAY_TEMPLATE.id) {
        idMap.set(dayId, dayId);
        continue;
      }
      const day = await db.dayTemplates.get(dayId);
      if (!day) continue;
      const cloneId = newId();
      idMap.set(dayId, cloneId);
      await db.dayTemplates.add({
        id: cloneId,
        name: day.name,
        exerciseIds: [...day.exerciseIds],
        isRestDay: day.isRestDay,
      });
    }
    await db.splits.add({
      id: copyId,
      name: `${split.name} (copy)`,
      dayTemplateIds: split.dayTemplateIds
        .filter((id) => idMap.has(id))
        .map((id) => idMap.get(id)!),
      isActive: false,
      anchorDate: split.anchorDate,
      anchorIndex: split.anchorIndex,
    });
  });
  return copyId;
}

/**
 * Deletes a custom split and any day templates only it referenced.
 * Exercises and their SetLog history are never touched — exercises are the
 * durable entity; splits are purely organizational. If the deleted split
 * was active, the default (or first remaining) split takes over.
 */
export async function deleteSplit(split: Split) {
  if (split.isDefault) return;
  await db.transaction("rw", db.splits, db.dayTemplates, async () => {
    const others = (await db.splits.toArray()).filter((s) => s.id !== split.id);
    const referenced = new Set(others.flatMap((s) => s.dayTemplateIds));
    const orphaned = [...new Set(split.dayTemplateIds)].filter(
      (id) => id !== REST_DAY_TEMPLATE.id && !referenced.has(id),
    );
    await db.dayTemplates.bulkDelete(orphaned);
    await db.splits.delete(split.id);
    if (split.isActive) {
      const fallback = others.find((s) => s.isDefault) ?? others[0];
      if (fallback) await db.splits.update(fallback.id, { isActive: true });
    }
  });
}

/** Appends a new (blank or rest) day to the rotation. */
export async function addDay(split: Split, opts: { rest?: boolean } = {}) {
  if (opts.rest) {
    const rest = await db.dayTemplates.get(REST_DAY_TEMPLATE.id);
    if (!rest) await db.dayTemplates.add(REST_DAY_TEMPLATE);
    await db.splits.update(split.id, {
      dayTemplateIds: [...split.dayTemplateIds, REST_DAY_TEMPLATE.id],
    });
    return;
  }
  const workoutCount = split.dayTemplateIds.filter(
    (id) => id !== REST_DAY_TEMPLATE.id,
  ).length;
  const dayId = newId();
  await db.transaction("rw", db.splits, db.dayTemplates, async () => {
    await db.dayTemplates.add({
      id: dayId,
      name: `Day ${workoutCount + 1}`,
      exerciseIds: [],
    });
    await db.splits.update(split.id, {
      dayTemplateIds: [...split.dayTemplateIds, dayId],
    });
  });
}

/**
 * Removes the rotation slot at `index`; the day template is deleted too
 * when nothing else references it.
 */
export async function removeDaySlot(split: Split, index: number) {
  const dayId = split.dayTemplateIds[index];
  const next = split.dayTemplateIds.filter((_, i) => i !== index);
  await db.transaction("rw", db.splits, db.dayTemplates, async () => {
    await db.splits.update(split.id, { dayTemplateIds: next });
    if (dayId === REST_DAY_TEMPLATE.id || next.includes(dayId)) return;
    const others = await db.splits.toArray();
    const stillReferenced = others.some(
      (s) => s.id !== split.id && s.dayTemplateIds.includes(dayId),
    );
    if (!stillReferenced) await db.dayTemplates.delete(dayId);
  });
}

export async function reorderRotation(split: Split, from: number, to: number) {
  if (from === to || to < 0 || to >= split.dayTemplateIds.length) return;
  const next = [...split.dayTemplateIds];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  await db.splits.update(split.id, { dayTemplateIds: next });
}

export async function renameDay(day: DayTemplate, name: string) {
  await db.dayTemplates.update(day.id, { name: name.trim() || day.name });
}
