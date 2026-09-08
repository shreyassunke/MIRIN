// Screenshots the body-measurements tab: first-run empty state, then a seeded
// five-reading history at mobile, tablet and desktop widths.
//
// Like the other screenshot scripts here, this needs the protected routes to
// render: run it against a dev server with a signed-in session.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:5175";
const OUT = ".screenshots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (err) => errors.push(err.message));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

const shot = async (name) => {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log(`shot ${name}`);
};

// First run: no gender, no height, no readings.
await page.goto(`${BASE}/profile/measurements`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await shot("measure-empty");

await page.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await shot("measure-account-tab");

// Seed a plausible cut: waist and weight down, arm and chest up.
await page.goto(`${BASE}/profile/measurements`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.evaluate(async () => {
  const { db } = await import("/src/db/db.ts");
  await db.settings.put({ key: "body.gender", value: "male" });
  await db.settings.put({ key: "body.heightCm", value: "180" });
  const days = [
    "2026-07-14",
    "2026-07-28",
    "2026-08-11",
    "2026-08-25",
    "2026-09-08",
  ];
  const series = {
    "body-weight": [188, 186, 184.5, 183, 181.5],
    waist: [92, 91, 90, 89, 88.5],
    neck: [39.5, 39.5, 39.4, 39.4, 39.3],
    hips: [100, 99.5, 99, 98.5, 98],
    chest: [104, 104.5, 105, 105, 105.5],
    arm: [36, 36.3, 36.5, 36.8, 37],
    wrist: [17.8, 17.8, 17.8, 17.8, 17.8],
  };
  const updatedAt = new Date().toISOString();
  for (const [fieldId, values] of Object.entries(series)) {
    for (let i = 0; i < values.length; i++) {
      await db.measurementEntries.put({
        id: `seed-${fieldId}-${i}`,
        fieldId,
        dateKey: days[i],
        value: values[i],
        updatedAt,
      });
    }
  }
  await db.measurementFields.update("waist", { target: 84 });
  await db.measurementFields.update("arm", { target: 39.4 });
  await db.measurementFields.update("body-weight", { target: 175 });
});

await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await shot("measure-mobile");

// Expanded inline editor.
await page.getByRole("button", { name: /^Waist Sep/ }).click();
await page.waitForTimeout(400);
await shot("measure-editor");
await page.getByRole("button", { name: "Cancel" }).click();
await page.waitForTimeout(300);

// Add-field form.
await page.getByRole("button", { name: "Add field" }).first().click();
await page.waitForTimeout(400);
await shot("measure-add-field");
await page.getByRole("button", { name: "Cancel" }).click();
await page.waitForTimeout(300);

// Metric unit pass: cm tape + kg weight.
await page.evaluate(async () => {
  const { db } = await import("/src/db/db.ts");
  await db.settings.put({ key: "unit.length", value: "cm" });
  await db.settings.put({ key: "unit", value: "kg" });
});
await page.waitForTimeout(800);
await shot("measure-metric");
await page.evaluate(async () => {
  const { db } = await import("/src/db/db.ts");
  await db.settings.put({ key: "unit.length", value: "in" });
  await db.settings.put({ key: "unit", value: "lb" });
});
await page.waitForTimeout(600);

await page.setViewportSize({ width: 1280, height: 900 });
await page.waitForTimeout(600);
await shot("measure-desktop");

await page.setViewportSize({ width: 768, height: 1024 });
await page.waitForTimeout(600);
await shot("measure-tablet");

// Real viewport, scrolled to the end: does the fixed nav cover the last row?
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(400);
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/measure-nav-clearance.png` });
console.log("shot measure-nav-clearance");

await browser.close();

if (errors.length) {
  console.error("ERRORS:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("OK");
