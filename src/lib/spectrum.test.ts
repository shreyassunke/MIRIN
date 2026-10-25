import { describe, expect, it } from "vitest";
import type { SetLog } from "../db/db";
import { spectrumAnchor, spectrumPlace, spectrumTone } from "./spectrum";

function log(partial: Pick<SetLog, "weight" | "reps"> & Partial<SetLog>): SetLog {
  return {
    id: partial.id ?? `${partial.weight}-${partial.reps}-${partial.setNumber ?? 1}`,
    sessionId: "last",
    exerciseId: "squat",
    setNumber: partial.setNumber ?? 1,
    weight: partial.weight,
    reps: partial.reps,
    isWarmup: partial.isWarmup,
    inputMethod: partial.inputMethod ?? "manual",
  };
}

const backoff = {
  today: [] as SetLog[],
  prior: [
    log({ weight: 140, reps: 8 }),
    log({ weight: 140, reps: 6, setNumber: 2 }),
    log({ weight: 140, reps: 5, setNumber: 3 }),
  ],
  mode: "manual" as const,
  unit: "lb" as const,
  fallbackReps: 12,
};

function parseRgb(css: string) {
  const match = css.match(/rgb\((\d+)\s+(\d+)\s+(\d+)/);
  if (!match) throw new Error(css);
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) };
}

function channel(hex: number) {
  const s = hex / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function contrast(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) {
  const L = (c: { r: number; g: number; b: number }) =>
    0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
  const hi = Math.max(L(a), L(b));
  const lo = Math.min(L(a), L(b));
  return (hi + 0.05) / (lo + 0.05);
}

describe("spectrumAnchor", () => {
  it("stays quiet with no working history", () => {
    expect(
      spectrumAnchor({ today: [], prior: [], mode: "manual", unit: "lb", fallbackReps: 8 }),
    ).toBeNull();
  });

  it("ignores warm-ups, including a warm-up being logged now", () => {
    const prior = [log({ weight: 140, reps: 8, isWarmup: true })];
    expect(
      spectrumAnchor({ today: [], prior, mode: "manual", unit: "lb", fallbackReps: 8 }),
    ).toBeNull();
    const worked = spectrumAnchor(backoff);
    expect(
      spectrumAnchor({ ...backoff, loggingWarmup: true }),
    ).toBeNull();
    expect(worked).not.toBeNull();
  });

  it("puts maintenance on the repeated set and growth on the prescription", () => {
    const anchor = spectrumAnchor(backoff);
    expect(anchor).toEqual({
      maintenance: { weight: 140, reps: 8 },
      growth: { weight: 135, reps: 9 },
    });
  });

  it("repeats today's last working set once one is logged", () => {
    const anchor = spectrumAnchor({
      ...backoff,
      today: [log({ weight: 100, reps: 12 })],
    });
    expect(anchor?.maintenance).toEqual({ weight: 100, reps: 12 });
  });

  it("keeps the anchors in the display unit", () => {
    const anchor = spectrumAnchor({ ...backoff, unit: "kg" });
    expect(anchor).not.toBeNull();
    expect(anchor!.maintenance.weight).toBeLessThan(80);
    expect(anchor!.growth.weight).toBeLessThan(80);
  });
});

describe("spectrumPlace", () => {
  const anchor = spectrumAnchor(backoff)!;

  it("is sand on the repeated set and sage on the prescription", () => {
    expect(spectrumPlace(140, 8, anchor)).toBeCloseTo(0, 1);
    expect(spectrumPlace(135, 9, anchor)).toBeCloseTo(1, 1);
  });

  it("keeps a nearby set between the two, including one rep either side", () => {
    expect(spectrumPlace(140, 9, anchor)).toBeGreaterThan(0.2);
    expect(spectrumPlace(140, 9, anchor)).toBeLessThan(0.85);
    expect(spectrumPlace(135, 8, anchor)).toBeGreaterThan(0.2);
    expect(spectrumPlace(135, 8, anchor)).toBeLessThan(0.85);
    const mid = spectrumPlace(137.5, 8.5, anchor);
    expect(mid).toBeGreaterThan(0.25);
    expect(mid).toBeLessThan(0.75);
  });

  it("reads a much lighter load as too little tension, not as past the prescription", () => {
    expect(spectrumPlace(100, 8, anchor)).toBeLessThan(-0.8);
  });

  it("reads a much heavier load as danger on the heavy side", () => {
    expect(spectrumPlace(160, 8, anchor)).toBeGreaterThan(1.8);
  });

  it("moves smoothly along the loads between the two danger ends", () => {
    let previous = spectrumPlace(100, 8, anchor);
    for (let weight = 101; weight <= 170; weight += 1) {
      const place = spectrumPlace(weight, 8, anchor);
      expect(Math.abs(place - previous)).toBeLessThan(0.22);
      previous = place;
    }
  });

  it("lets one extra rep on a matched set lean green, and a large miss go red", () => {
    const matched = spectrumAnchor({
      today: [log({ weight: 100, reps: 8 })],
      prior: [log({ weight: 100, reps: 8 })],
      mode: "manual",
      unit: "lb",
      fallbackReps: 8,
    })!;
    expect(spectrumPlace(100, 8, matched)).toBeCloseTo(0, 1);
    expect(spectrumPlace(100, 9, matched)).toBeGreaterThan(0.35);
    expect(spectrumPlace(100, 9, matched)).toBeLessThan(1.15);
    expect(spectrumPlace(80, 8, matched)).toBeLessThan(-0.6);
    expect(spectrumPlace(120, 8, matched)).toBeGreaterThan(1.6);
  });

  it("treats unloaded repeats by reps, and an emptied loaded lift as too light", () => {
    const body = spectrumAnchor({
      today: [],
      prior: [log({ weight: 0, reps: 6 })],
      mode: "manual",
      unit: "lb",
      fallbackReps: 8,
    })!;
    expect(body.maintenance).toEqual({ weight: 0, reps: 6 });
    expect(body.growth.weight).toBe(0);
    expect(spectrumPlace(0, body.maintenance.reps, body)).toBeCloseTo(0, 1);
    expect(spectrumPlace(0, body.growth.reps, body)).toBeCloseTo(1, 1);
    expect(spectrumPlace(0, 2, body)).toBeLessThan(-0.6);
    expect(spectrumPlace(0, 4, anchor)).toBeLessThan(-1);
  });
});

describe("spectrumTone", () => {
  const anchor = spectrumAnchor(backoff)!;
  const paper = { r: 243, g: 242, b: 239 };
  const ground = { r: 10, g: 10, b: 10 };

  it("blends from sand through sage without a jump, and saves the hard red for the ends", () => {
    const at = (weight: number, reps: number) => parseRgb(spectrumTone(weight, reps, anchor).color);
    const sand = at(140, 8);
    const sage = at(135, 9);
    const lightDanger = at(100, 8);
    const heavyDanger = at(160, 8);
    expect(sage.g - sage.r).toBeGreaterThan(sand.g - sand.r + 20);
    expect(lightDanger.r).toBeGreaterThan(lightDanger.g + 40);
    expect(heavyDanger.r).toBeGreaterThan(heavyDanger.g + 40);
    expect(sand.r).toBeGreaterThan(sand.b + 25);
    expect(Math.abs(sand.g - sand.r)).toBeLessThan(40);
    expect(lightDanger.g).toBeGreaterThan(50);
    expect(heavyDanger.g).toBeGreaterThan(50);

    let previous = at(100, 8);
    for (let weight = 101; weight <= 170; weight += 1) {
      const color = at(weight, 8);
      expect(Math.abs(color.r - previous.r)).toBeLessThanOrEqual(24);
      expect(Math.abs(color.g - previous.g)).toBeLessThanOrEqual(24);
      expect(Math.abs(color.b - previous.b)).toBeLessThanOrEqual(24);
      previous = color;
    }
  });

  it("keeps large numerals readable on both grounds, including the soft top of the wash", () => {
    for (const [weight, reps] of [
      [140, 8],
      [135, 9],
      [137.5, 8.5],
      [100, 8],
      [160, 8],
    ] as const) {
      for (const light of [false, true]) {
        const tone = spectrumTone(weight, reps, anchor, light);
        const groundColor = light ? paper : ground;
        expect(contrast(parseRgb(tone.color), groundColor)).toBeGreaterThan(3);
        expect(contrast(parseRgb(tone.soft), groundColor)).toBeGreaterThan(3);
      }
    }
  });
});
