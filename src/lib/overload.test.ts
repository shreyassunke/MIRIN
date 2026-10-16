import { describe, expect, it } from "vitest";
import type { Exercise, SetLog } from "../db/db";
import { loggingLine, recommendNextSet } from "./overload";
import { resolveStageDraft } from "./stageDraft";

function log(partial: Pick<SetLog, "weight" | "reps"> & Partial<SetLog>): SetLog {
  return {
    id: partial.id ?? `${partial.weight}-${partial.reps}`,
    sessionId: "last",
    exerciseId: "leverage-incline-chest-press",
    setNumber: partial.setNumber ?? 1,
    weight: partial.weight,
    reps: partial.reps,
    inputMethod: partial.inputMethod ?? "manual",
  };
}

const press: Exercise = {
  id: "leverage-incline-chest-press",
  name: "Leverage Incline Chest Press",
  muscleGroup: "chest",
  priorityOrder: 0,
};

describe("recommendNextSet", () => {
  it("steps the load down when last time missed the rep floor", () => {
    const recommendation = recommendNextSet({
      today: [],
      prior: [log({ weight: 140, reps: 8 }), log({ weight: 140, reps: 6, setNumber: 2 }), log({ weight: 140, reps: 5, setNumber: 3 })],
      mode: "manual",
      unit: "lb",
      fallbackReps: 12,
    });
    expect(recommendation).toMatchObject({ weight: 135, reps: 9 });
    expect(recommendation?.reason).toBe(
      "Last time 8, 6, 5. Short of 9, so this is 135×9.",
    );
  });
});

describe("loggingLine", () => {
  const recommendation = recommendNextSet({
    today: [],
    prior: [log({ weight: 140, reps: 8 }), log({ weight: 140, reps: 6, setNumber: 2 }), log({ weight: 140, reps: 5, setNumber: 3 })],
    mode: "manual",
    unit: "lb",
    fallbackReps: 12,
  })!;

  it("names the prescription in the stage's own words", () => {
    expect(
      loggingLine({
        recommendation,
        weight: 135,
        reps: 9,
        unit: "lb",
        qualifier: "both sides",
        onStage: true,
        range: recommendation.range,
      }),
    ).toBe("Last time 8, 6, 5. Short of 9, so this is 135 lb both sides × 9.");
  });

  it("names both numbers once the stage moves", () => {
    expect(
      loggingLine({
        recommendation,
        weight: 90,
        reps: 8,
        unit: "lb",
        qualifier: "both sides",
        onStage: false,
        range: recommendation.range,
      }),
    ).toBe("Suggested 135 lb both sides × 9. Logging 90 lb both sides × 8.");
  });
});

describe("resolveStageDraft", () => {
  it("opens on the prescription instead of the last raw set", () => {
    const draft = resolveStageDraft({
      exercise: press,
      logs: [],
      prior: [
        log({ weight: 140, reps: 8 }),
        log({ weight: 140, reps: 6, setNumber: 2 }),
        log({ weight: 140, reps: 5, setNumber: 3 }),
      ],
      warmupTarget: 0,
      unit: "lb",
      dayTemplateId: "chest-back",
    });
    expect(draft.manualWeight).toBe(135);
    expect(draft.reps).toBe(9);
  });
});
