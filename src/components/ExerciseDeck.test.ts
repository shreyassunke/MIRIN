import { describe, expect, it } from "vitest";
import { commitIndex, settleDurationMs } from "../hooks/usePagerGesture";

describe("exercise page swipe", () => {
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
