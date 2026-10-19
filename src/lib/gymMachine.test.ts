import { describe, expect, it } from "vitest";
import { gymMachineFor, stationsForExercise, stationsForMuscle } from "./library";

describe("gymMachineFor t-bar row", () => {
  it("shows the chest-supported station for the machine", () => {
    expect(
      gymMachineFor({ id: "lying-t-bar-row", name: "Lying T-Bar Row" }),
    ).toBe("t-bar-row");
  });

  it("keeps the barbell t-bar row on the bar", () => {
    expect(
      gymMachineFor({
        id: "t-bar-row-with-handle",
        name: "T-Bar Row with Handle",
      }),
    ).toBeNull();
  });

  it("uses the station when a t-bar row is logged as a machine", () => {
    expect(
      gymMachineFor({
        id: "t-bar-row-with-handle",
        name: "T-Bar Row with Handle",
        equipment: "machine",
        isCustom: true,
      }),
    ).toBe("t-bar-row");
  });
});

describe("gymMachineFor selectorized stations", () => {
  it("maps each seeded machine to its station", () => {
    expect(gymMachineFor({ id: "leg-extensions", name: "Leg Extensions" })).toBe(
      "leg-extension",
    );
    expect(gymMachineFor({ id: "thigh-adductor", name: "Thigh Adductor" })).toBe(
      "inner-thigh",
    );
    expect(gymMachineFor({ id: "thigh-abductor", name: "Thigh Abductor" })).toBe(
      "outer-thigh",
    );
    expect(
      gymMachineFor({ id: "machine-preacher-curls", name: "Machine Preacher Curls" }),
    ).toBe("preacher");
    expect(gymMachineFor({ id: "butterfly", name: "Butterfly" })).toBe("pec-deck");
    expect(gymMachineFor({ id: "dip-machine", name: "Dip Machine" })).toBe("seated-dip");
    expect(gymMachineFor({ id: "cable-row", name: "Cable Row" })).toBe("seated-row");
    expect(gymMachineFor({ id: "lat-pulldown", name: "Lat Pulldown" })).toBe(
      "lat-pulldown",
    );
  });

  it("maps the selectorized shoulder press and leaves free-weight presses alone", () => {
    expect(
      gymMachineFor({
        id: "leverage-shoulder-press",
        name: "Leverage Shoulder Press",
      }),
    ).toBe("shoulder-press");
    expect(
      gymMachineFor({
        id: "machine-shoulder-military-press",
        name: "Machine Shoulder (Military) Press",
      }),
    ).toBe("shoulder-press");
    expect(
      gymMachineFor({
        id: "custom-shoulder-press",
        name: "Shoulder press",
        equipment: "machine",
        isCustom: true,
      }),
    ).toBe("shoulder-press");
    expect(
      gymMachineFor({ id: "dumbbell-shoulder-press", name: "Dumbbell Shoulder Press" }),
    ).toBeNull();
    expect(
      gymMachineFor({
        id: "smith-machine-overhead-shoulder-press",
        name: "Smith Machine Overhead Shoulder Press",
      }),
    ).toBeNull();
    expect(
      gymMachineFor({ id: "cable-shoulder-press", name: "Cable Shoulder Press" }),
    ).toBe("cable");
    expect(
      gymMachineFor({
        id: "calf-machine-shoulder-shrug",
        name: "Calf-Machine Shoulder Shrug",
      }),
    ).toBeNull();
  });

  it("shows the lateral raise station only for machine work", () => {
    expect(gymMachineFor({ id: "lateral-raise", name: "Lateral Raise" })).toBeNull();
    expect(
      gymMachineFor({
        id: "lateral-raise",
        name: "Lateral Raise",
        equipment: "machine",
        isCustom: true,
      }),
    ).toBe("lateral-raise");
  });

  it("keeps rear and lying laterals off the shoulder station", () => {
    expect(
      gymMachineFor({
        id: "dumbbell-lying-rear-lateral-raise",
        name: "Dumbbell Lying Rear Lateral Raise",
        equipment: "machine",
        isCustom: true,
      }),
    ).toBeNull();
  });

  it("keeps a barbell preacher curl on the bar", () => {
    expect(gymMachineFor({ id: "preacher-curl", name: "Preacher Curl" })).toBeNull();
  });

  it("uses a saved station on a custom machine", () => {
    expect(
      gymMachineFor({
        id: "custom-chest-pec-deck-fly",
        name: "chest pec deck fly",
        equipment: "machine",
        isCustom: true,
        station: "pec-deck",
      }),
    ).toBe("pec-deck");
  });

  it("lets a saved station override the name", () => {
    expect(
      gymMachineFor({
        id: "custom-fly",
        name: "Lat Pulldown",
        equipment: "machine",
        isCustom: true,
        station: "pec-deck",
      }),
    ).toBe("pec-deck");
  });

  it("ignores a saved station when the lift is not on a machine", () => {
    expect(
      gymMachineFor({
        id: "custom-fly",
        name: "Custom press",
        equipment: "dumbbell",
        isCustom: true,
        station: "pec-deck",
      }),
    ).toBeNull();
  });

  it("offers the stations for the selected muscle", () => {
    expect(stationsForMuscle("chest")).toEqual([
      "chest-press",
      "pec-deck",
      "seated-dip",
    ]);
    expect(
      gymMachineFor({
        id: "custom-chest-press",
        name: "Plate loaded chest press",
        equipment: "machine",
        isCustom: true,
      }),
    ).toBe("chest-press");
    expect(stationsForMuscle("lats")).toEqual([
      "lat-pulldown",
      "seated-row",
      "t-bar-row",
    ]);
    expect(stationsForMuscle("quadriceps")).toEqual(["leg-extension", "leg-press"]);
    expect(stationsForMuscle("shoulders")).toEqual([
      "shoulder-press",
      "lateral-raise",
    ]);
    expect(stationsForMuscle("abdominals")).toEqual([]);
    expect(
      stationsForExercise({
        id: "rear-delt-flye",
        name: "Rear Delt Flye",
        muscleGroup: "Shoulders",
      }),
    ).toEqual(["pec-deck", "lat-pulldown", "seated-row", "t-bar-row"]);
    expect(
      stationsForExercise({
        id: "lateral-raise",
        name: "Lateral Raise",
        muscleGroup: "Shoulders",
      }),
    ).toEqual(["lateral-raise"]);
    expect(
      stationsForExercise({
        id: "leverage-shoulder-press",
        name: "Leverage Shoulder Press",
        muscleGroup: "Shoulders",
      }),
    ).toEqual(["shoulder-press"]);
    expect(
      gymMachineFor({
        id: "rear-delt-flye",
        name: "Rear Delt Flye",
        equipment: "machine",
        isCustom: true,
        station: "seated-row",
      }),
    ).toBe("seated-row");
  });

  it("keeps bench dips off the seated dip station", () => {
    expect(
      gymMachineFor({
        id: "bench-dips",
        name: "Bench Dips",
        equipment: "machine",
        isCustom: true,
      }),
    ).toBeNull();
  });
});
