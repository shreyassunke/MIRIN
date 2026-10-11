import { useEffect, useState } from "react";
import { exerciseCatalog, muscleCatalog } from "./data";
import { computeRecruitment, type FiberRecruitment } from "./recruitment";
import type { Muscle } from "./types";

export interface MusclePlate {
  outline: string;
  viewBox: [number, number, number, number];
  origin: [number, number];
  insertion: [number, number];
}

/** The head with the largest involvement. Primes win a tie. */
export function primaryMuscle(exerciseId: string): Muscle | null {
  const exercise = exerciseCatalog.find((row) => row.exerciseId === exerciseId);
  if (!exercise || exercise.muscles.length === 0) return null;
  const ranked = [...exercise.muscles].sort((a, b) => {
    if (a.role === "prime" && b.role !== "prime") return -1;
    if (b.role === "prime" && a.role !== "prime") return 1;
    return b.involvement - a.involvement;
  });
  const pick = ranked[0];
  return muscleCatalog.find((muscle) => muscle.id === pick.muscleId) ?? null;
}

/**
 * Opening-rep recruitment for the strand field.
 * With no estimated 1RM, intensity is reps over the working-range top plus
 * four, the same stand-in the current card uses.
 * Reserve at rep one is the reserve left at the end of the set, plus the
 * reps still ahead, so a multi-rep set is not treated as a max on rep one.
 */
export function openingRecruitment(args: {
  muscleId: string;
  exerciseId: string;
  weight: number;
  reps: number;
  e1rm: number;
  repMax: number;
}): FiberRecruitment {
  const loaded = args.e1rm > 0 && args.weight > 0;
  const relativeLoad = loaded
    ? Math.min(1, args.weight / args.e1rm)
    : Math.min(1, Math.max(0, args.reps) / (args.repMax + 4));
  const endReserve = loaded
    ? Math.max(0, 30 * (args.e1rm / args.weight - 1) - args.reps)
    : Math.max(0, args.repMax - args.reps);
  const repsInReserve = args.reps <= 1 ? endReserve : endReserve + args.reps - 1;
  return computeRecruitment({
    muscleId: args.muscleId,
    exerciseId: args.exerciseId,
    relativeLoad,
    repIndex: 0,
    repsInReserve,
  });
}

export async function loadMusclePlate(muscleId: string): Promise<MusclePlate | null> {
  try {
    const [svgRes, anchorRes] = await Promise.all([
      fetch(`/anatomy/svg/${muscleId}.svg`),
      fetch("/anatomy/anchors.json"),
    ]);
    if (!svgRes.ok || !anchorRes.ok) return null;
    const svg = await svgRes.text();
    const anchors = (await anchorRes.json()) as {
      muscles?: Record<string, MusclePlate>;
    };
    const outline = svg.match(/\sd="([^"]+)"/)?.[1];
    const muscle = anchors.muscles?.[muscleId];
    if (!outline || !muscle?.viewBox || !muscle.origin || !muscle.insertion) return null;
    return {
      outline,
      viewBox: muscle.viewBox,
      origin: muscle.origin,
      insertion: muscle.insertion,
    };
  } catch {
    return null;
  }
}

/** `undefined` while the outline is loading, `null` when this head has none. */
export function useMusclePlate(muscleId: string | null): MusclePlate | null | undefined {
  const [plate, setPlate] = useState<MusclePlate | null | undefined>(
    muscleId ? undefined : null,
  );

  useEffect(() => {
    if (!muscleId) {
      setPlate(null);
      return;
    }
    let cancel = false;
    setPlate(undefined);
    void loadMusclePlate(muscleId).then((next) => {
      if (!cancel) setPlate(next);
    });
    return () => {
      cancel = true;
    };
  }, [muscleId]);

  return plate;
}
