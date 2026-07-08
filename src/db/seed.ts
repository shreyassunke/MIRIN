import type { Transaction } from "dexie";
import type { DayTemplate, Exercise, Split } from "./db";
import { DEFAULT_ANCHOR_DATE } from "../lib/rotation";

const slug = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const DEFAULT_SPLIT_ID = "ppl-arms-cb";

/** Shared rest-day template referenced by any split's rest slots. */
export const REST_DAY_TEMPLATE: DayTemplate = {
  id: "rest",
  name: "Rest",
  exerciseIds: [],
  isRestDay: true,
};

// Exercises are deduped by name so a movement shared across days
// (Barbell Curl, Lateral Raise, Rear Delt Flye) carries one history.
const DAYS: { name: string; exercises: [string, string][] }[] = [
  {
    name: "Push",
    exercises: [
      ["Incline Barbell Press", "Chest"],
      ["Overhead Press", "Shoulders"],
      ["Lateral Raise", "Shoulders"],
      ["Flat DB Press", "Chest"],
      ["Tricep Pushdown", "Triceps"],
    ],
  },
  {
    name: "Pull",
    exercises: [
      ["Wide-Grip Pulldown", "Back"],
      ["Barbell Row", "Back"],
      ["Rear Delt Flye", "Shoulders"],
      ["Face Pull", "Shoulders"],
      ["Barbell Curl", "Biceps"],
    ],
  },
  {
    name: "Legs",
    exercises: [
      ["Squat", "Quads"],
      ["RDL", "Hamstrings"],
      ["Leg Press", "Quads"],
      ["Leg Curl", "Hamstrings"],
      ["Calf Raise", "Calves"],
    ],
  },
  {
    name: "Arms",
    exercises: [
      ["Barbell Curl", "Biceps"],
      ["Skull Crusher", "Triceps"],
      ["Hammer Curl", "Biceps"],
      ["Overhead Tricep Extension", "Triceps"],
      ["Lateral Raise", "Shoulders"],
    ],
  },
  {
    name: "Chest & Back",
    exercises: [
      ["Incline DB Press", "Chest"],
      ["Cable Fly", "Chest"],
      ["Lat Pulldown", "Back"],
      ["Cable Row", "Back"],
      ["Rear Delt Flye", "Shoulders"],
    ],
  },
];

export async function seed(tx: Transaction) {
  const exercises = new Map<string, Exercise>();
  let order = 1;
  for (const day of DAYS) {
    for (const [name, muscleGroup] of day.exercises) {
      const id = slug(name);
      if (!exercises.has(id)) {
        exercises.set(id, { id, name, muscleGroup, priorityOrder: order++ });
      }
    }
  }

  const dayTemplates: DayTemplate[] = [
    ...DAYS.map((day) => ({
      id: slug(day.name),
      name: day.name,
      exerciseIds: day.exercises.map(([name]) => slug(name)),
    })),
    REST_DAY_TEMPLATE,
  ];

  // Mon–Fri workouts plus weekend rest, anchored to a Monday so the
  // 7-slot loop stays aligned with the calendar week.
  const split: Split = {
    id: DEFAULT_SPLIT_ID,
    name: "5-Day Rotation",
    dayTemplateIds: [
      "push",
      "pull",
      "legs",
      "arms",
      "chest-back",
      REST_DAY_TEMPLATE.id,
      REST_DAY_TEMPLATE.id,
    ],
    isActive: true,
    isDefault: true,
    anchorDate: DEFAULT_ANCHOR_DATE,
    anchorIndex: 0,
  };

  await tx.table("exercises").bulkAdd([...exercises.values()]);
  await tx.table("dayTemplates").bulkAdd(dayTemplates);
  await tx.table("splits").add(split);
}
