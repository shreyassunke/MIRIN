import { describe, expect, it } from "vitest";
import sternalSvg from "../../../public/anatomy/svg/pectoralis_major_sternal.svg?raw";
import { contains, generateStrands, parseOutline, strandOn } from "./strands";

const ratio = { I: 0.5, IIa: 0.3, IIx: 0.2 };

describe("generateStrands", () => {
  const ring: [number, number][] = [
    [0, 0],
    [100, 0],
    [100, 40],
    [0, 40],
  ];

  it("is stable for a muscle id and fills types in ratio order", () => {
    const first = generateStrands({
      muscleId: "pectoralis_major_sternal",
      ring,
      origin: [4, 20],
      insertion: [96, 20],
      ratio,
      count: 100,
    });
    const second = generateStrands({
      muscleId: "pectoralis_major_sternal",
      ring,
      origin: [4, 20],
      insertion: [96, 20],
      ratio,
      count: 100,
    });
    expect(first.map((strand) => strand.points.join())).toEqual(
      second.map((strand) => strand.points.join()),
    );
    const tally = { I: 0, IIa: 0, IIx: 0 };
    for (const strand of first) tally[strand.type] += 1;
    expect(tally.I).toBeGreaterThan(tally.IIa);
    expect(tally.IIa).toBeGreaterThan(tally.IIx);
  });

  it("keeps strands inside the outline", () => {
    const strands = generateStrands({
      muscleId: "box",
      ring,
      origin: [4, 20],
      insertion: [96, 20],
      ratio,
      count: 80,
    });
    expect(strands.length).toBeGreaterThan(60);
    for (const strand of strands) {
      expect(strand.points.length).toBeGreaterThanOrEqual(2);
      for (const point of strand.points) {
        expect(Number.isFinite(point[0])).toBe(true);
        expect(Number.isFinite(point[1])).toBe(true);
        expect(contains(ring, point, 2)).toBe(true);
      }
    }
  });

  it("lights Type I before IIa, and never past the recruitment fraction", () => {
    const strands = generateStrands({
      muscleId: "order",
      ring,
      origin: [4, 20],
      insertion: [96, 20],
      ratio,
      count: 90,
    });
    const low = { I: 0.4, IIa: 0, IIx: 0 };
    for (const strand of strands) {
      if (strand.type !== "I") expect(strandOn(strand, low)).toBe(false);
    }
    const lit = strands.filter((strand) => strand.type === "I" && strandOn(strand, low));
    const typeI = strands.filter((strand) => strand.type === "I");
    expect(lit.length).toBeGreaterThan(0);
    expect(lit.length).toBeLessThan(typeI.length);
    const more = strands.filter((strand) => strandOn(strand, { I: 1, IIa: 0.5, IIx: 0 }));
    expect(more.length).toBeGreaterThan(lit.length);
  });

  it("stays finite on an empty outline", () => {
    expect(
      generateStrands({
        muscleId: "none",
        ring: [],
        origin: [0, 0],
        insertion: [1, 0],
        ratio,
      }),
    ).toEqual([]);
  });
});

describe("pectoralis outline", () => {
  it("fans strands inside the exported sternal head", () => {
    const d = sternalSvg.match(/\sd="([^"]+)"/)?.[1] ?? "";
    const ring = parseOutline(d);
    expect(ring.length).toBeGreaterThan(10);
    const strands = generateStrands({
      muscleId: "pectoralis_major_sternal",
      ring,
      origin: [45.28, 548.6],
      insertion: [1040, 417.47],
      ratio,
      count: 120,
    });
    expect(strands.length).toBeGreaterThan(100);
    const xs = strands.flatMap((strand) => strand.points.map((point) => point[0]));
    const ringX = ring.map((point) => point[0]);
    const outlineSpan = Math.max(...ringX) - Math.min(...ringX);
    const covered = Math.max(...xs) - Math.min(...xs);
    expect(covered / outlineSpan).toBeGreaterThan(0.85);
    let inside = 0;
    let total = 0;
    for (const strand of strands) {
      for (const point of strand.points) {
        total += 1;
        if (contains(ring, point, 3)) inside += 1;
      }
    }
    expect(inside / total).toBeGreaterThan(0.92);
  });
});
