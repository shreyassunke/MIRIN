import { describe, expect, it } from "vitest";
import { isVariationTap } from "./modelTap";

describe("isVariationTap", () => {
  it("treats a still press as a tap", () => {
    expect(isVariationTap(0, false)).toBe(true);
    expect(isVariationTap(12, false)).toBe(true);
  });

  it("gives a longer move to scroll", () => {
    expect(isVariationTap(13, false)).toBe(false);
  });

  it("does not open the list while the exercise is paging", () => {
    expect(isVariationTap(0, true)).toBe(false);
    expect(isVariationTap(4, true)).toBe(false);
  });
});
