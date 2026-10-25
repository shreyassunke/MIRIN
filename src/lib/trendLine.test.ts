import { describe, expect, it } from "vitest";
import { fitLine } from "./trendLine";

describe("fitLine", () => {
  it("recovers a straight series", () => {
    const fit = fitLine([0, 2, 4, 6].map((value, i) => ({ value, i })));
    fit.forEach((value, index) => expect(value).toBeCloseTo(index * 2));
  });

  it("stays flat when every session matches", () => {
    const fit = fitLine([40, 40, 40].map((value) => ({ value })));
    fit.forEach((value) => expect(value).toBeCloseTo(40));
  });

  it("uses the mean when every point shares an index", () => {
    const fit = fitLine([
      { value: 10, i: 2 },
      { value: 30, i: 2 },
    ]);
    fit.forEach((value) => expect(value).toBeCloseTo(20));
  });
});
