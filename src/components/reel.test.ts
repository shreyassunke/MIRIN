import { describe, expect, it } from "vitest";
import { reelSnap, rubberband, settleReel } from "./reel";

const stepByOne = (direction: -1 | 1, value: number) => value + direction;

describe("settleReel", () => {
  it("raises the value when the finger moves up a full detent", () => {
    expect(settleReel(-36, 36, stepByOne, 10)).toEqual({ steps: [1], offset: 0 });
  });

  it("keeps the leftover so the digit can track between detents", () => {
    expect(settleReel(-18, 36, stepByOne, 10)).toEqual({ steps: [], offset: -18 });
    expect(settleReel(-54, 36, stepByOne, 10)).toEqual({ steps: [1], offset: -18 });
  });

  it("lowers the value when the finger moves down", () => {
    expect(settleReel(72, 36, stepByOne, 10)).toEqual({ steps: [-1, -1], offset: 0 });
  });

  it("pinches at the end instead of inventing another step", () => {
    const capped = (direction: -1 | 1, value: number) =>
      Math.min(10, Math.max(0, value + direction));
    const settled = settleReel(-80, 36, capped, 10);
    expect(settled.steps).toEqual([]);
    expect(Math.abs(settled.offset)).toBeLessThan(36);
    expect(Math.sign(settled.offset)).toBe(-1);
  });

  it("stops after the last real step in one flick", () => {
    const capped = (direction: -1 | 1, value: number) =>
      Math.min(1, Math.max(0, value + direction));
    const settled = settleReel(-80, 36, capped, 0);
    expect(settled.steps).toEqual([1]);
    expect(Math.abs(settled.offset)).toBeLessThan(36);
  });
});

describe("reelSnap", () => {
  it("finishes a detent once the finger has passed halfway", () => {
    expect(reelSnap(-20, 36, () => true)).toEqual({ direction: 1, target: -36 });
    expect(reelSnap(20, 36, () => true)).toEqual({ direction: -1, target: 36 });
  });

  it("returns the digit when the drag stops short", () => {
    expect(reelSnap(-10, 36, () => true)).toEqual({ direction: 0, target: 0 });
  });

  it("returns the digit at a boundary", () => {
    expect(reelSnap(-20, 36, () => false)).toEqual({ direction: 0, target: 0 });
  });
});

describe("rubberband", () => {
  it("stays inside the detent and keeps the finger's direction", () => {
    expect(rubberband(0, 36)).toBe(0);
    expect(rubberband(80, 36)).toBeLessThan(36);
    expect(rubberband(-80, 36)).toBeGreaterThan(-36);
  });
});
