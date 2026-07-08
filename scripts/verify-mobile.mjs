// Verifies the mobile UI: wheel picker behavior, logo placement, lazy routes.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:5174";
const OUT = ".screenshots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
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

// Logo in the mobile top bar.
await expect("logo visible in mobile corner", () =>
  page.locator('header img[alt="MIRIN"]').isVisible(),
);

// Open Lateral Raise -> dumbbell wheel, prefilled at 15 lb.
await page.getByRole("button", { name: /Lateral Raise/ }).click();
await page.waitForTimeout(500);
const wheel = page.getByRole("listbox", { name: /Dumbbell weight/ });
await expect("wheel visible", () => wheel.isVisible());
await expect("wheel prefilled at 15", () =>
  page
    .getByRole("option", { name: "15", exact: true })
    .getAttribute("aria-selected")
    .then((v) => v === "true"),
);
await page.screenshot({ path: `${OUT}/wheel-initial.png`, fullPage: true });

// Flick the wheel: scroll three notches heavier (15 -> 22.5 in lb steps).
await wheel.evaluate((el) => {
  el.scrollBy({ top: 36 * 3, behavior: "instant" });
});
await page.waitForTimeout(500);
await expect("wheel scrolled to 22.5", () =>
  page
    .getByRole("option", { name: "22.5", exact: true })
    .getAttribute("aria-selected")
    .then((v) => v === "true"),
);
await expect("total shows 22.5", () =>
  page.locator("text=22.5").first().isVisible(),
);
await page.screenshot({ path: `${OUT}/wheel-scrolled.png`, fullPage: true });

// Tap an option -> snaps there.
await page.getByRole("option", { name: "30", exact: true }).click();
await page.waitForTimeout(700);
await expect("tap selects 30", () =>
  page
    .getByRole("option", { name: "30", exact: true })
    .getAttribute("aria-selected")
    .then((v) => v === "true"),
);

// Log the set with the wheel value.
await page.getByRole("button", { name: /^Log set 1/ }).click();
await page.waitForTimeout(500);
await expect("set logged at 30", () =>
  page.locator("text=30×8").first().isVisible(),
);
await page.getByRole("button", { name: "Dismiss rest timer" }).click();

// Unit switch repositions the wheel to the nearest kg dumbbell.
await page
  .getByRole("group", { name: "Weight unit" })
  .getByRole("button", { name: "kg" })
  .click();
await page.waitForTimeout(600);
await expect("kg wheel repositioned", async () => {
  const selected = await page
    .locator('[role="option"][aria-selected="true"]')
    .first()
    .textContent();
  return selected !== null && Number(selected) > 0;
});
await page.screenshot({ path: `${OUT}/wheel-kg.png`, fullPage: true });
await page
  .getByRole("group", { name: "Weight unit" })
  .getByRole("button", { name: "lb", exact: true })
  .click();
await page.waitForTimeout(400);

// Lazy routes still render.
await page.goto(`${BASE}/trends`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await expect("trends renders (lazy)", () =>
  page.getByRole("heading", { name: "Trends" }).isVisible(),
);
await page.goto(`${BASE}/split`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await expect("split renders (lazy)", () =>
  page.getByRole("heading", { name: "Split" }).isVisible(),
);

await browser.close();

if (errors.length || failures.length) {
  if (errors.length) console.error("PAGE ERRORS:\n" + errors.join("\n"));
  if (failures.length)
    console.error("ASSERTION FAILURES:\n" + failures.join("\n"));
  process.exit(1);
}
console.log("OK: all mobile assertions passed");
