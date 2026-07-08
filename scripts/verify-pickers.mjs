// End-to-end verification of the plate/dumbbell weight pickers.
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
const failures = [];
page.on("pageerror", (err) => errors.push(err.message));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

const expect = async (name, cond) => {
  if (!(await cond())) failures.push(name);
};

await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
await page.waitForTimeout(700);

// 1. Incline Barbell Press defaults to barbell mode, prefilled 95 lb
//    (45 bar + 25/side from greedy decompose of the starting default).
await expect("barbell mode default", () =>
  page
    .getByRole("button", { name: "Barbell", exact: true })
    .first()
    .getAttribute("aria-pressed")
    .then((v) => v === "true"),
);
await expect("prefill total 95", () =>
  page.locator("text=95").first().isVisible(),
);
await page.screenshot({ path: `${OUT}/picker-barbell-prefill.png`, fullPage: true });

// 2. Add a 10 lb plate to each side -> 115 total, stack updates.
await page
  .getByRole("button", { name: "Add 10 lb plate to each side" })
  .click();
await page.waitForTimeout(300);
await expect("total 115 after +10", () =>
  page.locator("text=115").first().isVisible(),
);
await expect("bar svg loaded", () =>
  page
    .getByRole("img", { name: /Bar loaded with 25, 10 per side/ })
    .isVisible(),
);
await page.screenshot({ path: `${OUT}/picker-barbell-stack.png`, fullPage: true });

// 3. Remove the 10 plate by tapping it on the bar.
await page.getByRole("button", { name: "Remove 10 lb plate" }).click();
await page.waitForTimeout(300);
await expect("total back to 95", () =>
  page.locator("text=95").first().isVisible(),
);

// 4. Log the set; breakdown should persist.
await page.getByRole("button", { name: "Add 10 lb plate to each side" }).click();
await page.getByRole("button", { name: /^Log set 1/ }).click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: "Dismiss rest timer" }).click();

// 5. kg toggle converts everything live.
await page
  .getByRole("group", { name: "Weight unit" })
  .getByRole("button", { name: "kg" })
  .click();
await page.waitForTimeout(500);
await expect("kg bar options appear", () =>
  page.getByRole("button", { name: "20 kg", exact: true }).isVisible(),
);
await page.screenshot({ path: `${OUT}/picker-barbell-kg.png`, fullPage: true });
await page
  .getByRole("group", { name: "Weight unit" })
  .getByRole("button", { name: "lb", exact: true })
  .click();
await page.waitForTimeout(400);

// 6. Lateral Raise opens in dumbbell mode with nearest dumbbell (15 lb).
await page.getByRole("button", { name: /Lateral Raise/ }).click();
await page.waitForTimeout(400);
await expect("dumbbell mode default", () =>
  page
    .getByRole("button", { name: "Dumbbell", exact: true })
    .first()
    .getAttribute("aria-pressed")
    .then((v) => v === "true"),
);
await expect("dumbbell 15 selected", () =>
  page
    .getByRole("option", { name: "15", exact: true })
    .getAttribute("aria-selected")
    .then((v) => v === "true"),
);
await page.screenshot({ path: `${OUT}/picker-dumbbell.png`, fullPage: true });

// 7. Mode memory: switch Lateral Raise to manual, reload, must reopen manual.
await page.getByRole("button", { name: "Manual", exact: true }).click();
await page.waitForTimeout(400);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(700);
await page.getByRole("button", { name: /Lateral Raise/ }).click();
await page.waitForTimeout(400);
await expect("mode remembered after reload", () =>
  page
    .getByRole("button", { name: "Manual", exact: true })
    .first()
    .getAttribute("aria-pressed")
    .then((v) => v === "true"),
);
await page.screenshot({ path: `${OUT}/picker-manual-memory.png`, fullPage: true });

// 8. "Same as last time" replays the stored plate stack: seed a completed
//    prior session with a breakdown, reload, and check the reconstruction.
await page.evaluate(async () => {
  const { db } = await import("/src/db/db.ts");
  const date = new Date(Date.now() - 3 * 86400000).toISOString();
  // chest-back so the rotation's next day is Push (where Incline lives).
  await db.sessions.put({
    id: "verify-prior",
    date,
    dayTemplateId: "chest-back",
    completed: true,
  });
  await db.setLogs.bulkPut(
    [1, 2, 3].map((n) => ({
      id: `verify-prior-set-${n}`,
      sessionId: "verify-prior",
      exerciseId: "incline-barbell-press",
      setNumber: n,
      weight: 155,
      reps: 8,
      inputMethod: "barbell",
      loadBreakdown: { barWeight: 45, platesPerSide: [45, 10] },
    })),
  );
  // Clear today's open session so prefill reads the seeded history.
  const open = await db.sessions.filter((s) => !s.completed).toArray();
  for (const s of open) {
    await db.setLogs.where("sessionId").equals(s.id).delete();
    await db.sessions.delete(s.id);
  }
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(700);
await expect("stack reconstructed from breakdown", () =>
  page
    .getByRole("img", { name: /Bar loaded with 45, 10 per side/ })
    .isVisible(),
);
await expect("total 155 from breakdown", () =>
  page.locator("text=155").first().isVisible(),
);
await page.screenshot({ path: `${OUT}/picker-breakdown-prefill.png`, fullPage: true });

// 9. History view shows the breakdown line.
await page.goto(`${BASE}/exercise/incline-barbell-press`, {
  waitUntil: "networkidle",
});
await page.waitForTimeout(600);
await expect("history breakdown line", () =>
  page.locator("text=Bar 45 + 45 · 10 per side").isVisible(),
);
await page.screenshot({ path: `${OUT}/picker-history.png`, fullPage: true });

await browser.close();

if (errors.length || failures.length) {
  if (errors.length) console.error("PAGE ERRORS:\n" + errors.join("\n"));
  if (failures.length) console.error("ASSERTION FAILURES:\n" + failures.join("\n"));
  process.exit(1);
}
console.log("OK: all picker assertions passed");
