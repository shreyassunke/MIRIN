import { describe, expect, it } from "vitest";
import type { Goal } from "../db/db";
import { crossedGoals, firstStrike, isGoalMet } from "./goals";
import { liftMark } from "./liftPose";

function goal(partial: Partial<Goal> & Pick<Goal, "id" | "targetWeight">): Goal {
  return {
    exerciseId: "incline-db-press",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("lift marks", () => {
  it("engraves an incline dumbbell for incline DB press", () => {
    expect(liftMark("Incline DB Press", "dumbbell")).toEqual({
      pose: "incline",
      implement: "dumbbell",
    });
  });

  it("prefers the movement over the incline in the name", () => {
    expect(liftMark("Incline Dumbbell Curl").pose).toBe("curl");
    expect(liftMark("Incline Dumbbell Flyes").pose).toBe("fly");
    expect(liftMark("Rear Delt Flye").pose).toBe("raise");
  });

  it("reads pulldown, squat, and hinge as their own marks", () => {
    expect(liftMark("Lat Pulldown", "cable").pose).toBe("pulldown");
    expect(liftMark("Back Squat", "barbell").pose).toBe("squat");
    expect(liftMark("Romanian Deadlift").pose).toBe("hinge");
  });
});

describe("crossed goals", () => {
  const open = goal({ id: "a", targetWeight: 65 });

  it("strikes only the set that crosses an open target", () => {
    expect(crossedGoals([open], 60, 65).map((item) => item.id)).toEqual(["a"]);
    expect(crossedGoals([open], 65, 70)).toEqual([]);
    expect(crossedGoals([open], 50, 60)).toEqual([]);
    expect(
      crossedGoals([{ ...open, achievedAt: "2026-10-01T00:00:00.000Z" }], 60, 70),
    ).toEqual([]);
  });

  it("treats an already-met best as a record without a fresh strike", () => {
    expect(isGoalMet(open, 65)).toBe(true);
    expect(isGoalMet(open, 60)).toBe(false);
    expect(isGoalMet({ ...open, achievedAt: "2026-10-18T12:00:00.000Z" }, 0)).toBe(
      true,
    );
  });

  it("dates the record from the earliest session that met it", () => {
    const strike = firstStrike(
      [
        {
          id: "later",
          sessionId: "s2",
          exerciseId: "incline-db-press",
          setNumber: 1,
          weight: 70,
          reps: 8,
        },
        {
          id: "first",
          sessionId: "s1",
          exerciseId: "incline-db-press",
          setNumber: 1,
          weight: 65,
          reps: 8,
        },
      ],
      [
        { id: "s1", date: "2026-09-01T15:00:00.000Z" },
        { id: "s2", date: "2026-10-18T15:00:00.000Z" },
      ],
      "incline-db-press",
      65,
    );
    expect(strike).toEqual({ at: "2026-09-01T15:00:00.000Z", weight: 65 });
  });
});
