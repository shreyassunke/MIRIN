import { describe, expect, it } from "vitest";
import { REGION_IDS } from "../../lib/muscleRegions";
import { headShade, pectoralShade, plateIdForRegion } from "./plate";

const weight = (exerciseId: string, name: string, muscleId: string) =>
  pectoralShade(exerciseId, name).find((head) => head.muscleId === muscleId)?.weight ?? 0;

describe("pectoralShade", () => {
  it("ranks a catalogued incline toward the clavicular head", () => {
    const shade = pectoralShade("incline-barbell-press");
    expect(shade[0]?.muscleId).toBe("pectoralis_major_clavicular");
    expect(shade[0]?.weight).toBe(1);
    expect(weight("incline-barbell-press", "", "pectoralis_major_abdominal")).toBeLessThan(
      weight("incline-barbell-press", "", "pectoralis_major_sternal"),
    );
  });

  it("ranks an unlisted decline toward the abdominal head", () => {
    const shade = pectoralShade("decline-barbell-press", "Decline Barbell Press");
    expect(shade[0]?.muscleId).toBe("pectoralis_major_abdominal");
    expect(weight("decline-barbell-press", "Decline", "pectoralis_major_clavicular")).toBeLessThan(
      weight("decline-barbell-press", "Decline", "pectoralis_major_sternal"),
    );
  });

  it("keeps a flat press broad, with the sternal head at the top", () => {
    const shade = pectoralShade("barbell-bench-press");
    expect(shade[0]?.muscleId).toBe("pectoralis_major_sternal");
    expect(weight("barbell-bench-press", "", "pectoralis_major_clavicular")).toBeGreaterThan(0.4);
    expect(weight("barbell-bench-press", "", "pectoralis_major_abdominal")).toBeGreaterThan(0.4);
  });
});

const top = (group: string, id: string, name = "") => headShade(group, id, name)[0]?.muscleId;

describe("headShade", () => {
  it("covers every training region with a plate", () => {
    for (const region of REGION_IDS) {
      expect(plateIdForRegion(region).length).toBeGreaterThan(0);
      expect(headShade(plateIdForRegion(region), "unlisted", "", region).length).toBeGreaterThan(0);
    }
  });

  it("follows the split lifts onto the head they load", () => {
    expect(top("deltoid", "overhead-press", "Overhead Press")).toBe("deltoid_clavicular");
    expect(top("deltoid", "lateral-raise", "Lateral Raise")).toBe("deltoid_acromial");
    expect(top("deltoid", "rear-delt-flye", "Rear Delt Flye")).toBe("deltoid_spinal");
    expect(top("deltoid", "face-pull", "Face Pull")).toBe("deltoid_spinal");
    expect(top("triceps_brachii", "tricep-pushdown", "Tricep Pushdown")).toBe("triceps_medial");
    expect(top("triceps_brachii", "skull-crusher", "Skull Crusher")).toBe("triceps_long");
    expect(top("triceps_brachii", "overhead-tricep-extension")).toBe("triceps_long");
    expect(top("biceps_brachii", "barbell-curl", "Barbell Curl")).toBe("biceps_short");
    expect(top("biceps_brachii", "hammer-curl", "Hammer Curl")).toBe("brachialis");
    expect(top("quadriceps", "squat", "Squat")).toBe("vastus_lateralis");
    expect(top("quadriceps", "leg-press", "Leg Press")).toBe("vastus_lateralis");
    expect(top("quadriceps", "leg-extension", "Leg Extension")).toBe("rectus_femoris");
    expect(top("hamstrings", "rdl", "RDL")).toBe("biceps_femoris_long");
    expect(top("hamstrings", "leg-curl", "Leg Curl")).toBe("semitendinosus");
    expect(top("triceps_surae", "calf-raise", "Calf Raise")).toBe("gastrocnemius_medial");
    expect(top("triceps_surae", "seated-calf-raise", "Seated Calf Raise")).toBe("soleus");
    expect(top("trapezius", "barbell-shrug", "Barbell Shrug")).toBe("trapezius_descending");
    expect(top("latissimus_dorsi", "lat-pulldown", "Lat Pulldown")).toBe("latissimus_dorsi");
  });
});
