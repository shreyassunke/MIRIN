import { describe, expect, it } from "vitest";
import {
  contributionLevel,
  contributionYears,
  setsOnDay,
  trailingContribution,
  yearContribution,
  type TrainingDay,
} from "./history";

const today = new Date(2026, 9, 16);

function counting(calendar: ReturnType<typeof trailingContribution>): number {
  return calendar.columns.reduce(
    (sum, column) => sum + column.days.filter((day) => day.counts).length,
    0,
  );
}

describe("contribution calendar", () => {
  it("builds a Sunday-aligned trailing year that stops at today", () => {
    const calendar = trailingContribution(today);
    expect(calendar.startKey).toBe("2025-10-17");
    expect(calendar.endKey).toBe("2026-10-16");
    expect(counting(calendar)).toBe(365);
    for (const column of calendar.columns) {
      expect(column.days).toHaveLength(7);
      expect(column.days[0].date.getDay()).toBe(0);
      expect(column.days[6].date.getDay()).toBe(6);
    }
    const last = calendar.columns.at(-1)!;
    expect(last.days[5]).toMatchObject({ key: "2026-10-16", counts: true });
    expect(last.days[6].counts).toBe(false);
    expect(calendar.months[0]).toMatchObject({ column: 0 });
    for (let index = 1; index < calendar.months.length; index++) {
      expect(
        calendar.months[index].column - calendar.months[index - 1].column,
      ).toBeGreaterThanOrEqual(2);
    }
    const november = new Date(2025, 10, 1).toLocaleDateString(undefined, {
      month: "short",
    });
    expect(calendar.months.some((month) => month.label === november)).toBe(true);
  });

  it("covers a past calendar year without days outside it", () => {
    const leap = yearContribution(2024, today);
    const common = yearContribution(2025, today);
    expect(leap.startKey).toBe("2024-01-01");
    expect(leap.endKey).toBe("2024-12-31");
    expect(counting(leap)).toBe(366);
    expect(counting(common)).toBe(365);
    expect(leap.columns[0].days[0].counts).toBe(false);
    expect(leap.columns[0].days.some((day) => day.key === "2024-01-01" && day.counts)).toBe(
      true,
    );
  });

  it("lists the current year back to the earliest log", () => {
    expect(contributionYears(["2024-05-01", "2026-01-02"], today)).toEqual([
      2026, 2025, 2024,
    ]);
    expect(contributionYears([], today)).toEqual([2026]);
  });

  it("buckets set volume into five shades", () => {
    expect(contributionLevel(0)).toBe(0);
    expect(contributionLevel(4)).toBe(1);
    expect(contributionLevel(9)).toBe(2);
    expect(contributionLevel(15)).toBe(3);
    expect(contributionLevel(16)).toBe(4);
  });

  it("counts every set, or one exercise when a target is focused", () => {
    const day: TrainingDay = {
      marked: true,
      bestByExercise: new Map([["a", 100]]),
      sessions: [
        {
          session: { id: "s", date: "2026-10-16", dayTemplateId: "d", completed: true },
          dayName: "Push",
          setCount: 12,
          exerciseCount: 2,
          exercises: [
            { exerciseId: "a", best: 100, sets: 4 },
            { exerciseId: "b", best: 40, sets: 8 },
          ],
        },
      ],
    };
    expect(setsOnDay(day, null)).toBe(12);
    expect(setsOnDay(day, "a")).toBe(4);
    expect(setsOnDay(undefined, null)).toBe(0);
  });
});
