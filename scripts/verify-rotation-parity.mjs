// Proves the generalized rotation reproduces the previous production
// behavior for the default split: Mon-Fri -> push/pull/legs/arms/chest-back,
// Sat/Sun -> rest, for every date across several years (incl. DST shifts).
// Run: node --experimental-strip-types scripts/verify-rotation-parity.mjs
import {
  dayTemplateIdForDate,
  weekdayLabels,
  nextWorkout,
  DEFAULT_ANCHOR_DATE,
} from "../src/lib/rotation.ts";

const WEEK = ["push", "pull", "legs", "arms", "chest-back"];
const defaultSplit = {
  dayTemplateIds: [...WEEK, "rest", "rest"],
  anchorDate: DEFAULT_ANCHOR_DATE,
  anchorIndex: 0,
};

/** The pre-migration logic, verbatim. */
function legacyDayTemplateIdForDate(weekSchedule, date) {
  const weekday = date.getDay();
  if (weekday === 0 || weekday === 6) return null;
  return weekSchedule[weekday - 1] ?? null;
}

let checked = 0;
let failures = 0;
for (
  let d = new Date(2023, 0, 1);
  d < new Date(2028, 0, 1);
  d.setDate(d.getDate() + 1)
) {
  const date = new Date(d);
  const legacy = legacyDayTemplateIdForDate(WEEK, date);
  const nextId = dayTemplateIdForDate(defaultSplit, date);
  const next = nextId === "rest" ? null : nextId;
  if (legacy !== next) {
    failures++;
    console.error(
      `MISMATCH ${date.toDateString()}: legacy=${legacy} new=${next}`,
    );
  }
  checked++;
}

const labels = weekdayLabels(defaultSplit);
const expectedLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
if (JSON.stringify(labels) !== JSON.stringify(expectedLabels)) {
  failures++;
  console.error(`Weekday labels wrong: ${labels}`);
}

// Rest-day skipping: from a Saturday the next workout is Monday's push.
const saturday = new Date(2026, 6, 11); // Sat Jul 11 2026
const upcoming = nextWorkout(
  defaultSplit,
  (id) => id === "rest",
  saturday,
  0,
);
if (!(upcoming?.dayTemplateId === "push" && upcoming.daysAway === 2)) {
  failures++;
  console.error(`nextWorkout from Saturday wrong:`, upcoming);
}

// A 4-day non-weekly rotation walks continuously with no calendar bias.
const fourDay = {
  dayTemplateIds: ["upper", "lower", "rest", "full"],
  anchorDate: "2026-07-08",
  anchorIndex: 0,
};
const seq = [];
for (let i = 0; i < 8; i++) {
  const date = new Date(2026, 6, 8 + i);
  seq.push(dayTemplateIdForDate(fourDay, date));
}
const expectedSeq = [
  "upper", "lower", "rest", "full",
  "upper", "lower", "rest", "full",
];
if (JSON.stringify(seq) !== JSON.stringify(expectedSeq)) {
  failures++;
  console.error(`4-day rotation wrong: ${seq}`);
}

if (failures) {
  console.error(`FAILED: ${failures} mismatches over ${checked} dates`);
  process.exit(1);
}
console.log(
  `OK: default split identical to legacy weekday logic across ${checked} dates; rest skipping and non-weekly rotations correct`,
);
