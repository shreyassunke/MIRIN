import { useEffect, useState } from "react";
import type { RegionId } from "../../lib/muscleRegions";
import { exerciseCatalog, muscleCatalog } from "./data";
import { computeRecruitment, type FiberRecruitment } from "./recruitment";
import type { FiberType, Muscle } from "./types";

export interface MusclePlate {
  outline: string;
  viewBox: [number, number, number, number];
  origin: [number, number];
  insertion: [number, number];
}

export interface PectoralPlate {
  outline: string;
  viewBox: [number, number, number, number];
  heads: { id: string; outline: string }[];
}

const PECTORAL_HEADS = [
  "pectoralis_major_clavicular",
  "pectoralis_major_sternal",
  "pectoralis_major_abdominal",
] as const;

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
  /** Catalog involvement when this lift lists the head. Otherwise the prime-mover stand-in. */
  involvement?: number;
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
    involvement: args.involvement,
  });
}

/** Catalog involvement for this head, or 0.8 when the lift has no row for it. */
export function primeInvolvement(exerciseId: string, muscleId: string): number {
  const listed = exerciseCatalog.find((row) => row.exerciseId === exerciseId);
  const match = listed?.muscles.find((row) => row.muscleId === muscleId);
  if (match == null || !Number.isFinite(match.involvement)) return 0.8;
  return Math.min(1, Math.max(0, match.involvement));
}

/** The part after the comma, or the whole name when the muscle is one piece. */
export function headLabel(muscleId: string): string {
  const name = muscleCatalog.find((muscle) => muscle.id === muscleId)?.name ?? muscleId;
  return name.split(",")[1]?.trim() || name;
}

export function fiberRatio(muscleId: string): Record<FiberType, number> {
  const ratio = muscleCatalog.find((muscle) => muscle.id === muscleId)?.fiberTypeRatio;
  if (!ratio) return { I: 0.5, IIa: 0.33, IIx: 0.17 };
  return { I: ratio.I, IIa: ratio.IIa, IIx: ratio.IIx };
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

export interface HeadShade {
  muscleId: string;
  /** 1 is the most activated head of this lift. The rest are a fraction of that. */
  weight: number;
}

interface ShadeRule {
  test: RegExp;
  weights: Record<string, number>;
}

interface PlateSpec {
  /** Heads in the shared frame, brightest-label order is decided per lift. */
  heads: readonly string[];
  /**
   * Order, not a measured EMG percent. The first matching rule wins.
   * A catalog row for these heads wins over the rules.
   */
  rules: readonly ShadeRule[];
  fallback: Record<string, number>;
  regionFallback?: Partial<Record<RegionId, Record<string, number>>>;
}

/**
 * Which plate a training region draws, and how a variation shifts its heads.
 *
 * Chest: Rodríguez-Ridao et al. 2020 — upper pectoralis highest at 30°,
 * middle and lower highest flat; decline raises the abdominal portion.
 * Deltoid: Coratella et al. 2020 — a neutral lateral raise is the acromial
 * part; a front raise is the clavicular part. Overhead press follows the
 * clavicular part. A reverse fly or face pull follows the spinal part.
 * Triceps: a pushdown reads highest in the medial head, then lateral, then
 * long. Overhead work and skull crushers lengthen the long head, which
 * crosses the shoulder, so that head leads.
 * Biceps: a supinated curl uses both heads. A hammer curl shifts toward
 * brachialis. Shoulder flexion (preacher) favors the short head; shoulder
 * extension (incline) favors the long head.
 * Quads: a squat or leg press leads with the vastii; a knee extension leads
 * with rectus femoris.
 * Hamstrings: a hinge leads with biceps femoris long head and
 * semimembranosus. The short head does not cross the hip. A curl leads with
 * semitendinosus.
 * Calves: a straight knee is gastrocnemius. A bent knee is soleus
 * (Elder et al. 1982: soleus 76% type I).
 */
const PLATES: Record<string, PlateSpec> = {
  pectoralis_major: {
    heads: PECTORAL_HEADS,
    rules: [
      {
        test: /\bincline\b/,
        weights: {
          pectoralis_major_clavicular: 1,
          pectoralis_major_sternal: 0.55,
          pectoralis_major_abdominal: 0.25,
        },
      },
      {
        test: /\b(decline|dips?)\b/,
        weights: {
          pectoralis_major_abdominal: 1,
          pectoralis_major_sternal: 0.7,
          pectoralis_major_clavicular: 0.35,
        },
      },
      {
        test: /\b(flye?s?|crossover|pec deck)\b/,
        weights: {
          pectoralis_major_sternal: 1,
          pectoralis_major_abdominal: 0.55,
          pectoralis_major_clavicular: 0.3,
        },
      },
    ],
    fallback: {
      pectoralis_major_sternal: 1,
      pectoralis_major_clavicular: 0.62,
      pectoralis_major_abdominal: 0.58,
    },
  },
  deltoid: {
    heads: ["deltoid_clavicular", "deltoid_acromial", "deltoid_spinal"],
    rules: [
      {
        test: /\b(rear|reverse fly|face pull)\b/,
        weights: { deltoid_spinal: 1, deltoid_acromial: 0.4, deltoid_clavicular: 0.15 },
      },
      {
        test: /\b(lateral raise|side raise|side delt)\b/,
        weights: { deltoid_acromial: 1, deltoid_clavicular: 0.35, deltoid_spinal: 0.25 },
      },
      {
        test: /\b(overhead|military|shoulder press|front raise|arnold)\b/,
        weights: { deltoid_clavicular: 1, deltoid_acromial: 0.55, deltoid_spinal: 0.15 },
      },
    ],
    fallback: { deltoid_clavicular: 1, deltoid_acromial: 0.5, deltoid_spinal: 0.2 },
    regionFallback: {
      "front-delt": { deltoid_clavicular: 1, deltoid_acromial: 0.5, deltoid_spinal: 0.2 },
      "side-delt": { deltoid_acromial: 1, deltoid_clavicular: 0.35, deltoid_spinal: 0.25 },
      "rear-delt": { deltoid_spinal: 1, deltoid_acromial: 0.4, deltoid_clavicular: 0.15 },
    },
  },
  triceps_brachii: {
    heads: ["triceps_long", "triceps_lateral", "triceps_medial"],
    rules: [
      {
        test: /\b(overhead|skull|french)\b/,
        weights: { triceps_long: 1, triceps_medial: 0.7, triceps_lateral: 0.6 },
      },
      {
        test: /\b(pushdown|pressdown|push down|kick ?back)\b/,
        weights: { triceps_medial: 1, triceps_lateral: 0.75, triceps_long: 0.45 },
      },
      {
        test: /\b(close grip|narrow)\b/,
        weights: { triceps_medial: 1, triceps_lateral: 0.7, triceps_long: 0.65 },
      },
      {
        test: /\bextension\b/,
        weights: { triceps_long: 1, triceps_medial: 0.7, triceps_lateral: 0.6 },
      },
    ],
    fallback: { triceps_lateral: 1, triceps_medial: 0.85, triceps_long: 0.6 },
  },
  biceps_brachii: {
    heads: ["biceps_long", "biceps_short", "brachialis"],
    rules: [
      {
        test: /\b(hammer|neutral grip)\b/,
        weights: { brachialis: 1, biceps_long: 0.55, biceps_short: 0.45 },
      },
      {
        test: /\b(preacher|concentration|spider)\b/,
        weights: { biceps_short: 1, biceps_long: 0.5, brachialis: 0.35 },
      },
      {
        test: /\bincline\b/,
        weights: { biceps_long: 1, biceps_short: 0.6, brachialis: 0.3 },
      },
    ],
    fallback: { biceps_short: 1, biceps_long: 0.9, brachialis: 0.35 },
  },
  trapezius: {
    heads: ["trapezius_descending", "trapezius_transverse", "trapezius_ascending"],
    rules: [
      {
        test: /\b(shrug|upright)\b/,
        weights: { trapezius_descending: 1, trapezius_transverse: 0.35, trapezius_ascending: 0.2 },
      },
      {
        test: /\b(row|face pull)\b/,
        weights: { trapezius_transverse: 1, trapezius_ascending: 0.75, trapezius_descending: 0.3 },
      },
    ],
    fallback: { trapezius_transverse: 1, trapezius_descending: 0.6, trapezius_ascending: 0.55 },
  },
  quadriceps: {
    heads: ["vastus_lateralis", "rectus_femoris", "vastus_medialis"],
    rules: [
      {
        test: /\b(extension|sissy)\b/,
        weights: { rectus_femoris: 1, vastus_medialis: 0.75, vastus_lateralis: 0.7 },
      },
      {
        test: /\b(hack|narrow|close stance)\b/,
        weights: { vastus_medialis: 1, vastus_lateralis: 0.8, rectus_femoris: 0.5 },
      },
    ],
    fallback: { vastus_lateralis: 1, vastus_medialis: 0.9, rectus_femoris: 0.45 },
  },
  hamstrings: {
    heads: ["biceps_femoris_long", "biceps_femoris_short", "semitendinosus", "semimembranosus"],
    rules: [
      {
        test: /\bcurl\b/,
        weights: {
          semitendinosus: 1,
          biceps_femoris_short: 0.9,
          biceps_femoris_long: 0.7,
          semimembranosus: 0.65,
        },
      },
      {
        test: /\b(stiff|romanian|rdl|good morning|deadlift)\b/,
        weights: {
          biceps_femoris_long: 1,
          semimembranosus: 0.85,
          semitendinosus: 0.5,
          biceps_femoris_short: 0.15,
        },
      },
    ],
    fallback: {
      biceps_femoris_long: 1,
      semimembranosus: 0.8,
      semitendinosus: 0.6,
      biceps_femoris_short: 0.2,
    },
  },
  triceps_surae: {
    heads: ["gastrocnemius_medial", "gastrocnemius_lateral", "soleus"],
    rules: [
      {
        test: /\bseated\b/,
        weights: { soleus: 1, gastrocnemius_medial: 0.3, gastrocnemius_lateral: 0.25 },
      },
    ],
    fallback: { gastrocnemius_medial: 1, gastrocnemius_lateral: 0.85, soleus: 0.45 },
  },
  gluteus_maximus: {
    heads: ["gluteus_maximus"],
    rules: [],
    fallback: { gluteus_maximus: 1 },
  },
  latissimus_dorsi: {
    heads: ["latissimus_dorsi"],
    rules: [],
    fallback: { latissimus_dorsi: 1 },
  },
  forearm: {
    heads: ["brachioradialis", "flexor_carpi_radialis"],
    rules: [
      {
        test: /\b(wrist|flexion)\b/,
        weights: { flexor_carpi_radialis: 1, brachioradialis: 0.3 },
      },
    ],
    fallback: { brachioradialis: 1, flexor_carpi_radialis: 0.4 },
  },
  erector_spinae: {
    heads: ["iliocostalis_lumborum", "longissimus_thoracis", "spinalis_thoracis"],
    rules: [],
    fallback: { longissimus_thoracis: 1, iliocostalis_lumborum: 0.85, spinalis_thoracis: 0.55 },
  },
  rectus_abdominis: {
    heads: ["rectus_abdominis_upper", "rectus_abdominis_middle", "rectus_abdominis_lower"],
    rules: [
      {
        test: /\b(hanging|leg raise|reverse crunch)\b/,
        weights: {
          rectus_abdominis_lower: 1,
          rectus_abdominis_middle: 0.65,
          rectus_abdominis_upper: 0.3,
        },
      },
      {
        test: /\b(crunch|sit ?up)\b/,
        weights: {
          rectus_abdominis_upper: 1,
          rectus_abdominis_middle: 0.7,
          rectus_abdominis_lower: 0.35,
        },
      },
    ],
    fallback: {
      rectus_abdominis_middle: 1,
      rectus_abdominis_upper: 0.8,
      rectus_abdominis_lower: 0.75,
    },
  },
};

const REGION_PLATE: Record<RegionId, string> = {
  chest: "pectoralis_major",
  "front-delt": "deltoid",
  "side-delt": "deltoid",
  "rear-delt": "deltoid",
  lats: "latissimus_dorsi",
  traps: "trapezius",
  biceps: "biceps_brachii",
  triceps: "triceps_brachii",
  forearms: "forearm",
  abs: "rectus_abdominis",
  quads: "quadriceps",
  hamstrings: "hamstrings",
  glutes: "gluteus_maximus",
  calves: "triceps_surae",
  "lower-back": "erector_spinae",
};

export function plateIdForRegion(region: RegionId): string {
  return REGION_PLATE[region];
}

export function plateHeads(groupId: string): readonly string[] {
  return PLATES[groupId]?.heads ?? [];
}

/**
 * Relative shade across one muscle for this variant.
 * 1 is the head this lift leans on. Catalog involvement wins when the lift
 * lists heads of this plate. Otherwise the rule is order, not an EMG percent.
 */
export function headShade(
  groupId: string,
  exerciseId: string,
  exerciseName = "",
  region?: RegionId | null,
): HeadShade[] {
  const plate = PLATES[groupId];
  if (!plate) return [];
  const listed = exerciseCatalog.find((row) => row.exerciseId === exerciseId);
  const raw: Record<string, number> = {};
  const listedHeads =
    listed?.muscles.filter((row) => plate.heads.includes(row.muscleId)) ?? [];
  if (listedHeads.length > 0) {
    for (const row of listedHeads) raw[row.muscleId] = row.involvement;
  } else {
    const text = `${exerciseId} ${exerciseName}`.toLowerCase().replace(/-/g, " ");
    const rule = plate.rules.find((entry) => entry.test.test(text));
    const fromRegion = region ? plate.regionFallback?.[region] : undefined;
    Object.assign(raw, rule?.weights ?? fromRegion ?? plate.fallback);
  }
  const peak = Math.max(...plate.heads.map((id) => raw[id] ?? 0), 0.001);
  return plate.heads
    .map((muscleId) => ({
      muscleId,
      weight: (raw[muscleId] ?? 0) / peak,
    }))
    .sort((a, b) => b.weight - a.weight);
}

/** @see headShade for the pectoralis. Kept so the chest cases stay named. */
export function pectoralShade(exerciseId: string, exerciseName = ""): HeadShade[] {
  return headShade("pectoralis_major", exerciseId, exerciseName, "chest");
}

const groupPlates = new Map<string, Promise<PectoralPlate | null>>();

export function loadGroupPlate(groupId: string): Promise<PectoralPlate | null> {
  const cached = groupPlates.get(groupId);
  if (cached) return cached;
  const pending = fetchGroupPlate(groupId);
  groupPlates.set(groupId, pending);
  return pending;
}

async function fetchGroupPlate(groupId: string): Promise<PectoralPlate | null> {
  try {
    const [svgRes, anchorRes] = await Promise.all([
      fetch(`/anatomy/svg/${groupId}.svg`),
      fetch("/anatomy/anchors.json"),
    ]);
    if (!svgRes.ok || !anchorRes.ok) return null;
    const svg = await svgRes.text();
    const anchors = (await anchorRes.json()) as { groups?: Record<string, { viewBox?: number[] }> };
    const viewBox = anchors.groups?.[groupId]?.viewBox;
    if (!viewBox || viewBox.length < 4) return null;
    const paths = [...svg.matchAll(/\sid="([^"]+)"[^>]*\sd="([^"]+)"/g)];
    const outline = paths.find((match) => match[1] === "outline")?.[2];
    const heads = paths
      .filter((match) => match[1] !== "outline")
      .map((match) => ({ id: match[1], outline: match[2] }));
    if (!outline || heads.length === 0) return null;
    return {
      outline,
      viewBox: [viewBox[0], viewBox[1], viewBox[2], viewBox[3]],
      heads,
    };
  } catch {
    return null;
  }
}

export async function loadPectoralPlate(): Promise<PectoralPlate | null> {
  return loadGroupPlate("pectoralis_major");
}

/** `undefined` while the pectoralis plate is loading, `null` when it is missing. */
export function usePectoralPlate(enabled: boolean): PectoralPlate | null | undefined {
  return useGroupPlate(enabled ? "pectoralis_major" : null);
}

/** `undefined` while the plate is loading, `null` when this muscle has none. */
export function useGroupPlate(groupId: string | null): PectoralPlate | null | undefined {
  const [plate, setPlate] = useState<PectoralPlate | null | undefined>(groupId ? undefined : null);

  useEffect(() => {
    if (!groupId) {
      setPlate(null);
      return;
    }
    let cancel = false;
    setPlate(undefined);
    void loadGroupPlate(groupId).then((next) => {
      if (!cancel) setPlate(next);
    });
    return () => {
      cancel = true;
    };
  }, [groupId]);

  return plate;
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
