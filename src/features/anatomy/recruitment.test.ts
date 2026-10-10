import { describe, expect, it } from "vitest";
import { exerciseCatalog, thresholds } from "./data";
import {
  changeVsStage,
  computeRecruitment,
  openingPoolShare,
  poolUnderLoad,
  type RecruitmentInput,
} from "./recruitment";

const STERNAL = "pectoralis_major_sternal";
const BENCH = "barbell-bench-press";

const bench = (
  patch: Partial<RecruitmentInput> = {},
): RecruitmentInput => ({
  muscleId: STERNAL,
  exerciseId: BENCH,
  relativeLoad: 0.6,
  repIndex: 0,
  repsInReserve: 3,
  ...patch,
});

const sternalInvolvement = () =>
  exerciseCatalog
    .find((row) => row.exerciseId === BENCH)
    ?.muscles.find((row) => row.muscleId === STERNAL)?.involvement ?? 0;

describe("computeRecruitment", () => {
  it("recruits a non-decreasing share of each type as load rises", () => {
    let previous = computeRecruitment(bench({ relativeLoad: 0 }));
    for (let step = 1; step <= 20; step++) {
      const next = computeRecruitment(bench({ relativeLoad: step / 20 }));
      expect(next.I).toBeGreaterThanOrEqual(previous.I);
      expect(next.IIa).toBeGreaterThanOrEqual(previous.IIa);
      expect(next.IIx).toBeGreaterThanOrEqual(previous.IIx);
      expect(poolUnderLoad(STERNAL, next)).toBeGreaterThanOrEqual(
        poolUnderLoad(STERNAL, previous),
      );
      previous = next;
    }
  });

  it("fills Type I before IIa or IIx", () => {
    const cap = sternalInvolvement();
    expect(cap).toBeGreaterThan(0);
    expect(thresholds.I).toBeLessThan(thresholds.IIa);
    expect(thresholds.IIa).toBeLessThan(thresholds.IIx);

    const between = (thresholds.I + thresholds.IIa) / 2;
    const mid = computeRecruitment(
      bench({ relativeLoad: between / cap, repIndex: 0, repsInReserve: 3 }),
    );
    expect(mid.I).toBeGreaterThan(0);
    expect(mid.I).toBeLessThan(1);
    expect(mid.IIa).toBe(0);
    expect(mid.IIx).toBe(0);

    const edge = computeRecruitment(
      bench({
        relativeLoad: thresholds.IIa / cap,
        repIndex: 0,
        repsInReserve: 3,
      }),
    );
    expect(edge.I).toBe(1);
    expect(edge.IIa).toBe(0);
    expect(edge.IIx).toBe(0);
  });

  it("keeps every fraction inside 0–1", () => {
    const cases: RecruitmentInput[] = [
      bench({ relativeLoad: -2, repIndex: -5, repsInReserve: -3 }),
      bench({ relativeLoad: 4, repIndex: 100, repsInReserve: 0 }),
      bench({ relativeLoad: 1, repIndex: 0, repsInReserve: 0 }),
    ];
    for (const input of cases) {
      const result = computeRecruitment(input);
      for (const key of ["I", "IIa", "IIx"] as const) {
        expect(result[key]).toBeGreaterThanOrEqual(0);
        expect(result[key]).toBeLessThanOrEqual(1);
      }
    }
  });

  it("stays finite when inputs are missing or non-numeric", () => {
    const cases: RecruitmentInput[] = [
      bench({
        relativeLoad: Number.NaN,
        repIndex: Number.NaN,
        repsInReserve: Number.NaN,
      }),
      bench({
        relativeLoad: Number.POSITIVE_INFINITY,
        repIndex: 0,
        repsInReserve: Number.POSITIVE_INFINITY,
      }),
      bench({ muscleId: "missing", relativeLoad: 0.8 }),
      bench({ exerciseId: "missing", relativeLoad: 0.8 }),
      bench({ relativeLoad: 0, repIndex: 0, repsInReserve: 4 }),
      bench({ relativeLoad: 1, repIndex: 0, repsInReserve: 0 }),
    ];
    for (const input of cases) {
      const result = computeRecruitment(input);
      expect(result.I).not.toBeNaN();
      expect(result.IIa).not.toBeNaN();
      expect(result.IIx).not.toBeNaN();
      const share = poolUnderLoad(input.muscleId, result);
      expect(share).not.toBeNaN();
      expect(share).toBeGreaterThanOrEqual(0);
      expect(share).toBeLessThanOrEqual(1);
    }

    const unloaded = computeRecruitment(
      bench({ relativeLoad: 0, repIndex: 0, repsInReserve: 4 }),
    );
    expect(unloaded).toEqual({ I: 0, IIa: 0, IIx: 0 });
    expect(
      computeRecruitment(bench({ muscleId: "missing", relativeLoad: 1 })),
    ).toEqual({ I: 0, IIa: 0, IIx: 0 });
  });

  it("recruits more of the pool on a later rep than on rep one", () => {
    const first = computeRecruitment(
      bench({ relativeLoad: 0.6, repIndex: 0, repsInReserve: 4 }),
    );
    const later = computeRecruitment(
      bench({ relativeLoad: 0.6, repIndex: 3, repsInReserve: 1 }),
    );
    expect(poolUnderLoad(STERNAL, later)).toBeGreaterThan(
      poolUnderLoad(STERNAL, first),
    );
  });
});

describe("opening-rep stat", () => {
  it("reads rep one and the point change against the stage", () => {
    const stage = openingPoolShare(
      bench({ relativeLoad: 0.5, repsInReserve: 3 }),
    );
    const next = openingPoolShare(
      bench({ relativeLoad: 0.75, repsInReserve: 3 }),
    );
    expect(stage).toBeGreaterThan(0);
    expect(stage).toBeLessThanOrEqual(1);
    expect(changeVsStage(next, stage)).toBe(
      Math.round(next * 100) - Math.round(stage * 100),
    );
    expect(changeVsStage(next, stage)).toBeGreaterThan(0);
    expect(changeVsStage(stage, stage)).toBe(0);
    expect(changeVsStage(Number.NaN, stage)).toBe(
      Math.round(0) - Math.round(stage * 100),
    );
  });
});
