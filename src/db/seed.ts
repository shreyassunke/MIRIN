import type { Transaction } from "dexie";
import type { DayTemplate, Exercise, Split } from "./db";

const slug = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

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

  const dayTemplates: DayTemplate[] = DAYS.map((day) => ({
    id: slug(day.name),
    name: day.name,
    exerciseIds: day.exercises.map(([name]) => slug(name)),
  }));

  const split: Split = {
    id: "ppl-arms-cb",
    name: "5-Day Rotation",
    dayTemplateIds: dayTemplates.map((d) => d.id),
  };

  await tx.table("exercises").bulkAdd([...exercises.values()]);
  await tx.table("dayTemplates").bulkAdd(dayTemplates);
  await tx.table("splits").add(split);
}
