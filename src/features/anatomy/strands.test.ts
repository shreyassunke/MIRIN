import { describe, expect, it } from "vitest";
import pectoralSvg from "../../../public/anatomy/svg/pectoralis_major.svg?raw";
import { contains, generateStrands, parseOutline, strandOn } from "./strands";

const plates = import.meta.glob(
  "../../../public/anatomy/svg/{pectoralis_major,deltoid,triceps_brachii,biceps_brachii,trapezius,quadriceps,hamstrings,triceps_surae,gluteus_maximus,forearm,erector_spinae,latissimus_dorsi,rectus_abdominis}.svg",
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

const ratio = { I: 0.5, IIa: 0.3, IIx: 0.2 };

describe("generateStrands", () => {
  const ring: [number, number][] = [
    [0, 0],
    [100, 10],
    [100, 30],
    [0, 40],
  ];

  it("is stable for a muscle id and fills types in ratio order", () => {
    const first = generateStrands({
      muscleId: "pectoralis_major",
      ring,
      ratio,
      count: 100,
    });
    const second = generateStrands({
      muscleId: "pectoralis_major",
      ring,
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
        ratio,
      }),
    ).toEqual([]);
  });
});

describe("muscle plates", () => {
  it("fans every split muscle onto its tendon", () => {
    expect(Object.keys(plates).length).toBe(13);
    for (const [file, svg] of Object.entries(plates)) {
      const paths = [...svg.matchAll(/\sid="([^"]+)"[^>]*\sd="([^"]+)"/g)];
      const outline = paths.find((match) => match[1] === "outline")?.[2] ?? "";
      const ring = parseOutline(outline);
      const heads = paths
        .filter((match) => match[1] !== "outline")
        .map((match) => ({ id: match[1], ring: parseOutline(match[2]) }));
      const strands = generateStrands({
        muscleId: file,
        ring,
        heads,
        ratio,
        count: 80,
      });
      expect(strands.length, file).toBeGreaterThan(40);
      expect(strands.filter((strand) => strand.head).length, file).toBeGreaterThan(20);
      for (const head of heads) {
        const placed = strands.filter((strand) => strand.head === head.id).length;
        expect(placed, `${file} ${head.id}`).toBeGreaterThan(3);
      }
    }
  });
});

describe("pectoralis outline", () => {
  it("fans the whole muscle onto the lateral tendon", () => {
    const paths = [...pectoralSvg.matchAll(/\sid="([^"]+)"[^>]*\sd="([^"]+)"/g)];
    const outline = paths.find((match) => match[1] === "outline")?.[2] ?? "";
    const ring = parseOutline(outline);
    const heads = paths
      .filter((match) => match[1] !== "outline")
      .map((match) => ({ id: match[1], ring: parseOutline(match[2]) }));
    expect(ring.length).toBeGreaterThan(10);
    expect(heads.length).toBe(3);
    const strands = generateStrands({
      muscleId: "pectoralis_major",
      ring,
      heads,
      ratio,
      count: 90,
    });
    expect(strands.length).toBeGreaterThan(70);
    const ends = strands.map((strand) => strand.points[strand.points.length - 1][0]);
    const starts = strands.map((strand) => strand.points[0][0]);
    expect(Math.min(...ends)).toBeGreaterThan(Math.min(...starts) + 200);
    const tagged = new Set(strands.map((strand) => strand.head).filter(Boolean));
    expect(tagged.size).toBeGreaterThan(1);
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
