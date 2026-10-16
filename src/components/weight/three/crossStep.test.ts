import { describe, expect, it } from "vitest";
import {
  CROSS_DEAD_PX,
  CROSS_STEP_PX,
  applyCrossTravel,
  crossAxisEngaged,
  crossStepCount,
  nextReps,
} from "./crossStep";

describe("crossStepCount", () => {
  it("ignores a straight slide and the dead zone", () => {
    expect(crossStepCount(0)).toBe(0);
    expect(crossStepCount(CROSS_DEAD_PX - 1)).toBe(0);
    expect(crossStepCount(-(CROSS_DEAD_PX - 1))).toBe(0);
    expect(crossStepCount(CROSS_DEAD_PX)).toBe(0);
  });

  it("steps once per 56px after the dead zone, rightward positive", () => {
    const first = CROSS_DEAD_PX + CROSS_STEP_PX;
    expect(crossStepCount(first - 1)).toBe(0);
    expect(crossStepCount(first)).toBe(1);
    expect(crossStepCount(first + CROSS_STEP_PX)).toBe(2);
    expect(crossStepCount(-first)).toBe(-1);
    expect(crossStepCount(-(first + CROSS_STEP_PX))).toBe(-2);
  });

  it("rejects a non-positive step", () => {
    expect(crossStepCount(200, CROSS_DEAD_PX, 0)).toBe(0);
  });
});

describe("crossAxisEngaged", () => {
  it("lights at the dead-zone edge, before the first step", () => {
    expect(crossAxisEngaged(CROSS_DEAD_PX - 1)).toBe(false);
    expect(crossAxisEngaged(CROSS_DEAD_PX)).toBe(true);
    expect(crossAxisEngaged(-CROSS_DEAD_PX)).toBe(true);
  });
});

describe("applyCrossTravel", () => {
  it("undoes reps when the finger returns to the start", () => {
    let reps = 8;
    let applied = 0;
    const commit = (dir: -1 | 1) => {
      reps += dir;
      return true;
    };
    applied = applyCrossTravel(CROSS_DEAD_PX + CROSS_STEP_PX * 2, applied, commit);
    expect(reps).toBe(10);
    expect(applied).toBe(2);
    applied = applyCrossTravel(CROSS_DEAD_PX + CROSS_STEP_PX, applied, commit);
    expect(reps).toBe(9);
    applied = applyCrossTravel(0, applied, commit);
    expect(reps).toBe(8);
    expect(applied).toBe(0);
  });

  it("does not bank a step the floor refused", () => {
    let reps = 1;
    const commit = (dir: -1 | 1) => {
      const next = nextReps(reps, dir);
      if (next == null) return false;
      reps = next;
      return true;
    };
    const applied = applyCrossTravel(-400, 0, commit);
    expect(reps).toBe(1);
    expect(applied).toBe(0);
    applyCrossTravel(CROSS_DEAD_PX + CROSS_STEP_PX, applied, commit);
    expect(reps).toBe(2);
  });
});

describe("nextReps", () => {
  it("steps by one and holds the floor", () => {
    expect(nextReps(7, 1)).toBe(8);
    expect(nextReps(7, -1)).toBe(6);
    expect(nextReps(1, -1)).toBeNull();
  });
});
