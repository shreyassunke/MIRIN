// Seeds three weeks of plausible history through the app's own Dexie module
// (via Vite's module transform), then screenshots the data-filled screens.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:5174";
const OUT = ".screenshots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (err) => errors.push(err.message));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);

await page.evaluate(async () => {
  const { db } = await import("/src/db/db.ts");
  const split = await db.splits.toCollection().first();
  const days = await db.dayTemplates.bulkGet(split.dayTemplateIds);
  const starts = {
    "incline-barbell-press": 95, "overhead-press": 65, "lateral-raise": 15,
    "flat-db-press": 50, "tricep-pushdown": 40, "wide-grip-pulldown": 100,
    "barbell-row": 95, "rear-delt-flye": 15, "face-pull": 30,
    "barbell-curl": 45, squat: 135, rdl: 135, "leg-press": 180,
    "leg-curl": 70, "calf-raise": 90, "skull-crusher": 40,
    "hammer-curl": 25, "overhead-tricep-extension": 30,
    "incline-db-press": 40, "cable-fly": 25, "lat-pulldown": 100,
    "cable-row": 100,
  };
  let dayCursor = 21; // days ago
  let rotation = 0;
  for (let week = 0; week < 3; week++) {
    for (const day of days) {
      const date = new Date(Date.now() - dayCursor * 86400000);
      dayCursor -= 1;
      const sessionId = `demo-${week}-${day.id}`;
      await db.sessions.put({
        id: sessionId,
        date: date.toISOString(),
        dayTemplateId: day.id,
        completed: true,
      });
      for (const exerciseId of day.exerciseIds) {
        const base = (starts[exerciseId] ?? 45) + week * 5;
        for (let set = 1; set <= 3; set++) {
          await db.setLogs.put({
            id: `demo-${week}-${day.id}-${exerciseId}-${set}`,
            sessionId,
            exerciseId,
            setNumber: set,
            weight: base,
            reps: day.id === "chest-back" ? 12 : 8 - (set - 1),
          });
        }
      }
      rotation++;
    }
    dayCursor -= 2; // rest days
  }
});

await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/data-today.png`, fullPage: true });

await page.goto(`${BASE}/exercise/lateral-raise`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/data-exercise.png`, fullPage: true });

await page.goto(`${BASE}/progress`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/data-trends.png`, fullPage: true });

await browser.close();

if (errors.length) {
  console.error("ERRORS:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("OK");
