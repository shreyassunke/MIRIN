import { describe, expect, it } from "vitest";
import { dotInkAt, dotSizeAt } from "./ExerciseDeck";
import { commitIndex, settleDurationMs } from "../hooks/usePagerGesture";

describe("ExerciseDeck dot synchronization", () => {
  it("matches settled 6px / 4px / 3px marks and interpolates 1:1 mid-swipe", () => {
    expect(dotSizeAt(0)).toBe(6);
    expect(dotSizeAt(1)).toBe(6);
    expect(dotSizeAt(2)).toBe(6);
    expect(dotSizeAt(2.5)).toBe(5);
    expect(dotSizeAt(3)).toBe(4);
    expect(dotSizeAt(3.5)).toBe(3.5);
    expect(dotSizeAt(4)).toBe(3);
    expect(dotSizeAt(5)).toBe(3);
  });

  it("brightens the incoming dot 1:1 during drag and locks on release", () => {
    // At rest on page 0
    expect(dotInkAt(0, 0, 0, false)).toBe(100);
    expect(dotInkAt(1, 0, 0, false)).toBe(42);

    // 30% into dragging from 0 -> 1: dot 1 brightens ahead of midpoint
    expect(dotInkAt(0, 0.3, 0, true)).toBe(100);
    expect(dotInkAt(1, 0.3, 0, true)).toBeGreaterThan(42);

    // Past 50% midpoint while dragging: dot 1 is 100%, dot 0 trails down
    expect(dotInkAt(1, 0.6, 1, true)).toBe(100);
    expect(dotInkAt(0, 0.6, 1, true)).toBeGreaterThan(42);

    // On flick release: committed target is 100%, all others 42% immediately
    expect(dotInkAt(1, 0.2, 1, false)).toBe(100);
    expect(dotInkAt(0, 0.2, 1, false)).toBe(42);
  });

  it("commits flicks and scales settle duration with distance and velocity", () => {
    expect(commitIndex(0.18, -0.32, 6)).toBe(1);
    expect(commitIndex(1.82, 0.32, 6)).toBe(1);
    expect(commitIndex(0.55, 0, 6)).toBe(1);

    const fullStep = settleDurationMs(1, 0, 360);
    const halfStep = settleDurationMs(0.4, 0, 360);
    const flickStep = settleDurationMs(0.75, -0.8, 360);

    expect(fullStep).toBeLessThanOrEqual(220);
    expect(halfStep).toBeLessThan(fullStep);
    expect(flickStep).toBeLessThan(fullStep);
    expect(settleDurationMs(0, 0, 360)).toBe(0);
  });
});
