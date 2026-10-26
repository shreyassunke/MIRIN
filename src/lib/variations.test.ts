import { describe, expect, it } from "vitest";
import {
  convertLoadForVariation,
  currentVariationId,
  draftPatchForVariation,
  nativeVariation,
  variationTitle,
  variationsFor,
} from "./variations";

const lat = { id: "lat-pulldown", name: "Lat Pulldown", equipment: "machine" };
const curl = { id: "barbell-curl", name: "Barbell Curl", equipment: "barbell" };

describe("variationsFor", () => {
  it("names pulldown substitutes", () => {
    const labels = variationsFor(lat).map((choice) => choice.label);
    expect(labels).toContain("Cable pulldown");
    expect(labels).toContain("One-arm cable pulldown");
    expect(labels).toContain("Pull-up");
  });

  it("falls back to implements for everything else", () => {
    const labels = variationsFor(curl).map((choice) => choice.label);
    expect(labels).toEqual([
      "Machine",
      "Cable",
      "One-arm cable",
      "Dumbbell",
      "Dumbbell, one side",
      "Barbell",
      "Bodyweight",
    ]);
  });
});

describe("convertLoadForVariation", () => {
  const machine = variationsFor(lat)[0]!;
  const cable = variationsFor(lat).find((choice) => choice.id === "cable")!;
  const oneArm = variationsFor(lat).find((choice) => choice.id === "cable-unilateral")!;
  const pullup = variationsFor(lat).find((choice) => choice.id === "bodyweight")!;
  const dumbbell = variationsFor(lat).find((choice) => choice.id === "dumbbell")!;

  it("keeps a shared stack when the station changes", () => {
    expect(convertLoadForVariation(50, machine, cable, "lb", 50)).toBe(50);
  });

  it("halves a shared stack for one arm", () => {
    expect(convertLoadForVariation(50, machine, oneArm, "lb", 50)).toBe(25);
  });

  it("halves a shared stack into a per-hand bell", () => {
    expect(convertLoadForVariation(50, machine, dumbbell, "lb", 50)).toBe(25);
  });

  it("clears the load for a pull-up and restores the held station", () => {
    expect(convertLoadForVariation(50, machine, pullup, "lb", 50)).toBe(0);
    expect(convertLoadForVariation(0, pullup, machine, "lb", 50)).toBe(50);
  });
});

describe("draftPatchForVariation", () => {
  it("does not store an id when the pick is the programmed station", () => {
    const native = nativeVariation(lat);
    const cable = variationsFor(lat).find((choice) => choice.id === "cable")!;
    const patch = draftPatchForVariation({
      exercise: lat,
      from: cable,
      to: native,
      total: 50,
      heldLoadLb: 50,
      barWeight: 45,
      unit: "lb",
    });
    expect(patch.variationId).toBeNull();
    expect(patch.manualWeight).toBe(50);
  });
});

describe("currentVariationId", () => {
  it("checks the programmed row before any pick", () => {
    expect(
      currentVariationId(lat, {
        variationId: null,
        mode: "manual",
        laterality: "bilateral",
      }),
    ).toBe("machine");
  });

  it("names the station and the implement on the title", () => {
    const incline = {
      id: "incline-db-press",
      name: "Incline DB Press",
      equipment: "dumbbell",
    };
    const programmed = {
      variationId: null,
      mode: "dumbbell" as const,
      laterality: "bilateral" as const,
      station: null,
    };
    expect(variationTitle(incline, programmed)).toBe("Incline DB Press");
    expect(
      variationTitle(incline, {
        variationId: "machine",
        mode: "manual",
        laterality: "bilateral",
        station: "chest-press",
      }),
    ).toBe("Incline Chest Press");
    expect(
      variationTitle(incline, {
        variationId: "cable",
        mode: "manual",
        laterality: "bilateral",
        station: null,
      }),
    ).toBe("Incline Cable Press");
    expect(
      variationTitle(incline, {
        variationId: "cable-unilateral",
        mode: "manual",
        laterality: "unilateral",
        station: null,
      }),
    ).toBe("One-arm Incline Cable Press");
    expect(
      variationTitle(incline, {
        variationId: "barbell",
        mode: "barbell",
        laterality: "bilateral",
        station: null,
      }),
    ).toBe("Incline Barbell Press");
    expect(
      variationTitle(lat, {
        variationId: null,
        mode: "manual",
        laterality: "bilateral",
        station: null,
      }),
    ).toBe("Lat Pulldown");
    expect(
      variationTitle(lat, {
        variationId: "bodyweight",
        mode: "manual",
        laterality: "bilateral",
        station: null,
      }),
    ).toBe("Pull-up");
  });

  it("checks a one-arm pulldown against its own row", () => {
    expect(
      currentVariationId(
        { id: "one-arm-lat-pulldown", name: "One Arm Lat Pulldown", equipment: "machine" },
        { variationId: null, mode: "manual", laterality: "unilateral" },
      ),
    ).toBe("machine-unilateral");
  });
});
