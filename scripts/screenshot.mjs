import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:5174";
const OUT = ".screenshots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const errors = [];

async function run(name, viewport, actions) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on("pageerror", (err) => errors.push(`${name}: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`${name} console: ${msg.text()}`);
  });
  await actions(page);
  await context.close();
}

const mobile = { width: 390, height: 844 };
const desktop = { width: 1440, height: 900 };

// Today, fresh state, mobile + desktop
await run("today-mobile", mobile, async (page) => {
  await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/today-mobile.png`, fullPage: true });
});

// Interactive flow: log two sets, capture timer, finish
await run("today-flow", mobile, async (page) => {
  await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /^Log set/ }).first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/today-logged-timer.png`, fullPage: true });
  await page.getByRole("button", { name: /^Log set/ }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /^Log set/ }).first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/today-advanced.png`, fullPage: true });
  await page.getByRole("button", { name: "Finish workout" }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/today-after-finish.png`, fullPage: true });
});

// Exercise detail after some data exists
await run("exercise", mobile, async (page) => {
  await page.goto(`${BASE}/exercise/incline-barbell-press`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/exercise-mobile.png`, fullPage: true });
});

await run("trends", mobile, async (page) => {
  await page.goto(`${BASE}/trends`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/trends-mobile.png`, fullPage: true });
});

await run("split", mobile, async (page) => {
  await page.goto(`${BASE}/split`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/split-mobile.png`, fullPage: true });
});

await run("today-desktop", desktop, async (page) => {
  await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/today-desktop.png`, fullPage: true });
});

await browser.close();

if (errors.length) {
  console.error("ERRORS:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("OK: screenshots written to " + OUT);
