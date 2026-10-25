import { describe, expect, it } from "vitest";
import {
  areaUnder,
  filterRange,
  formatPercent,
  monotoneCurve,
  paddedDomain,
  quoteDelta,
  rangeStart,
  trendTone,
  type QuotePoint,
} from "./quoteSeries";

const day = (iso: string, value: number): QuotePoint => ({
  t: new Date(iso).getTime(),
  value,
  label: iso,
});

describe("rangeStart", () => {
  const now = new Date(2026, 9, 24, 15, 0, 0);

  it("opens the year on January 1 for YTD", () => {
    expect(rangeStart("YTD", now)).toBe(new Date(2026, 0, 1).getTime());
  });

  it("keeps the full history for All", () => {
    expect(rangeStart("ALL", now)).toBeNull();
  });

  it("counts a month back from the start of today", () => {
    expect(rangeStart("1M", now)).toBe(new Date(2026, 8, 23).getTime());
  });
});

describe("filterRange", () => {
  const points = [
    day("2025-01-02", 100),
    day("2026-02-01", 110),
    day("2026-10-17", 120),
  ];

  it("drops sessions before the window", () => {
    const kept = filterRange(points, "1Y", new Date(2026, 9, 24));
    expect(kept.map((point) => point.value)).toEqual([110, 120]);
  });

  it("returns every session for All", () => {
    expect(filterRange(points, "ALL")).toHaveLength(3);
  });

  it("keeps July 10 out of a 3M window ending October 24", () => {
    const now = new Date(2026, 9, 24);
    const kept = filterRange(
      [
        day("2026-07-10T12:00:00", 70),
        day("2026-09-11T12:00:00", 57),
        day("2026-10-17T12:00:00", 80),
      ],
      "3M",
      now,
    );
    expect(kept.map((point) => point.label)).toEqual([
      "2026-09-11T12:00:00",
      "2026-10-17T12:00:00",
    ]);
  });
});

describe("quoteDelta", () => {
  it("reads a rise from the first print to the last", () => {
    const delta = quoteDelta([day("2026-01-01", 100), day("2026-02-01", 110)]);
    expect(delta).toMatchObject({ tone: "up", amount: 10, percent: 10 });
  });

  it("reads a fall", () => {
    const delta = quoteDelta([day("2026-01-01", 80), day("2026-02-01", 70)]);
    expect(delta?.tone).toBe("down");
    expect(delta?.amount).toBeCloseTo(-10);
  });

  it("treats a rounding-sized move as flat", () => {
    expect(quoteDelta([day("2026-01-01", 100), day("2026-02-01", 100.02)])?.tone).toBe(
      "flat",
    );
  });

  it("omits a percent when the window opens at zero", () => {
    expect(quoteDelta([day("2026-01-01", 0), day("2026-02-01", 40)])?.percent).toBeNull();
  });
});

describe("trendTone", () => {
  it("is up when the newer print is higher", () => {
    expect(trendTone(100, 110)).toBe("up");
  });

  it("is down when the newer print is lower", () => {
    expect(trendTone(80, 70)).toBe("down");
  });

  it("stays quiet when the move would round away", () => {
    expect(trendTone(100, 100.02)).toBeNull();
  });
});

describe("paddedDomain", () => {
  it("keeps a flat series off the edges", () => {
    const [min, max] = paddedDomain([40, 40]);
    expect(min).toBeLessThan(40);
    expect(max).toBeGreaterThan(40);
  });
});

describe("monotoneCurve", () => {
  it("draws a straight segment for two sessions", () => {
    expect(monotoneCurve([{ x: 0, y: 10 }, { x: 20, y: 4 }])).toBe("M 0 10 L 20 4");
  });

  it("stays between a rising series", () => {
    const points = [
      { x: 0, y: 30 },
      { x: 10, y: 20 },
      { x: 20, y: 10 },
    ];
    const path = monotoneCurve(points);
    expect(path.startsWith("M 0 30 C")).toBe(true);
    const ys = path.match(/[\d.]+ [\d.]+/g)?.map((pair) => Number(pair.split(" ")[1])) ?? [];
    ys.forEach((y) => {
      expect(y).toBeGreaterThanOrEqual(10);
      expect(y).toBeLessThanOrEqual(30);
    });
  });

  it("closes the wash on the plot floor", () => {
    expect(areaUnder("M 0 10 L 20 4", 0, 20, 40)).toBe("M 0 10 L 20 4 L 20 40 L 0 40 Z");
  });
});

describe("formatPercent", () => {
  it("signs a rise and a fall", () => {
    expect(formatPercent(2.34)).toBe("+2.3%");
    expect(formatPercent(-1)).toBe("−1.0%");
  });
});
