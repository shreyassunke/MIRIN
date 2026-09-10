// Screenshots the Log section: the master trend across all three metric
// groups, the Daily tab, and the Body tab — first-run empty and with a
// seeded history, at mobile and desktop widths.
//
// The protected routes need a session. Run against a dev server started with
// stub Supabase env vars; this script writes a local-only session into
// storage so AuthProvider resolves without any network call:
//
//   $env:VITE_SUPABASE_URL="https://stub.supabase.co"
//   $env:VITE_SUPABASE_ANON_KEY="stub"
//   npx vite --port 5180
//   node scripts/verify-log.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:5180";
const OUT = ".screenshots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

const errors = [];
// The stub Supabase host is unreachable by design; its failures are not defects.
const isStubNoise = (text) =>
  /stub\.supabase\.co|Failed to fetch|net::ERR|ERR_NAME_NOT_RESOLVED/i.test(
    text,
  );
page.on("pageerror", (err) => {
  if (!isStubNoise(err.message)) errors.push(`pageerror: ${err.message}`);
});
page.on("console", (msg) => {
  if (msg.type() === "error" && !isStubNoise(msg.text())) {
    errors.push(`console: ${msg.text()}`);
  }
});

const shot = async (name, fullPage = true) => {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
  console.log(`shot ${name}`);
};

// --- Sign in locally, without a network round trip -------------------------
await page.goto(`${BASE}/auth`, { waitUntil: "networkidle" });
const signedIn = await page.evaluate(async () => {
  const mod = await import("/src/lib/supabase.ts");
  if (!mod.isSupabaseConfigured) return false;
  const client = mod.getSupabase();
  const key = client?.auth?.storageKey;
  if (!key) return false;
  const user = {
    id: "00000000-0000-4000-8000-000000000000",
    aud: "authenticated",
    role: "authenticated",
    email: "lifter@example.com",
    user_metadata: { full_name: "Verification Run" },
    app_metadata: {},
    created_at: new Date().toISOString(),
  };
  localStorage.setItem(
    key,
    JSON.stringify({
      access_token: "local-verification-token",
      token_type: "bearer",
      expires_in: 31536000,
      expires_at: Math.floor(Date.now() / 1000) + 31536000,
      refresh_token: "local-verification-refresh",
      user,
    }),
  );
  return true;
});
if (!signedIn) {
  console.error(
    "Could not seed a session — start the dev server with stub Supabase env vars.",
  );
  await browser.close();
  process.exit(1);
}

// --- First run: nothing logged --------------------------------------------
await page.goto(`${BASE}/log`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
if (!(await page.getByRole("heading", { name: "Log", level: 1 }).count())) {
  console.error("Log screen did not render — auth or routing is wrong.");
  await page.screenshot({ path: `${OUT}/log-render-failure.png` });
  await browser.close();
  process.exit(1);
}
await shot("log-daily-empty");

await page.getByRole("link", { name: "Body" }).click();
await page.waitForTimeout(900);
await shot("log-body-empty");

// --- Seed a plausible cut -------------------------------------------------
await page.evaluate(async () => {
  const { db } = await import("/src/db/db.ts");
  await db.settings.put({ key: "body.gender", value: "male" });
  await db.settings.put({ key: "body.heightCm", value: "180" });
  const days = [
    "2026-08-05",
    "2026-08-12",
    "2026-08-19",
    "2026-08-26",
    "2026-09-02",
    "2026-09-09",
  ];
  const series = {
    "body-weight": [188, 186.5, 185, 184, 182.5, 181],
    waist: [92, 91.2, 90.4, 89.6, 89, 88.4],
    neck: [39.5, 39.5, 39.4, 39.4, 39.3, 39.3],
    hips: [100, 99.6, 99.1, 98.7, 98.3, 98],
    chest: [104, 104.3, 104.6, 105, 105.2, 105.5],
    arm: [36, 36.2, 36.4, 36.6, 36.8, 37],
    wrist: [17.8, 17.8, 17.8, 17.8, 17.8, 17.8],
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
  const protein = [150, 168, 172, 165, 175, 180];
  const calories = [2650, 2580, 2500, 2540, 2450, 2400];
  for (let i = 0; i < days.length; i++) {
    await db.nutritionLogs.put({
      id: days[i],
      proteinG: protein[i],
      calories: calories[i],
      updatedAt,
    });
  }
});

// --- Seeded: every metric group -------------------------------------------
await page.goto(`${BASE}/log`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await shot("log-daily");

for (const group of ["Daily", "Measurements", "Derived"]) {
  await page.getByRole("button", { name: group, exact: true }).click();
  await page.waitForTimeout(700);
  await shot(`log-trend-${group.toLowerCase()}`, false);
}

// Third metric within the active group, via the rail. The name must be exact:
// "Metric" would also match the "Metric group" chip track.
const rail = page.getByRole("group", { name: "Metric", exact: true });
const dots = rail.getByRole("button");
if ((await dots.count()) < 3) {
  errors.push(`rail has ${await dots.count()} dots, expected the Derived five`);
} else {
  // First paragraph of the trend section is the active metric's name.
  const activeMetric = page.locator("section:has(#log-trend) p").first();
  const before = await activeMetric.textContent();
  await dots.nth(2).click();
  await page.waitForTimeout(700);
  await shot("log-trend-rail-third", false);
  const after = await activeMetric.textContent();
  if (before === after) {
    errors.push(`rail click did not change the metric (still "${after}")`);
  }
  console.log(`rail: "${before}" -> "${after}"`);
}

// --- Body tab, seeded -----------------------------------------------------
await page.getByRole("link", { name: "Body" }).click();
await page.waitForTimeout(1200);
await shot("log-body");

await page.getByRole("button", { name: /^Waist/ }).click();
await page.waitForTimeout(500);
await shot("log-body-field-editor");
await page.getByRole("button", { name: "Cancel" }).click();
await page.waitForTimeout(300);

await page.getByRole("button", { name: /^Height/ }).first().click();
await page.waitForTimeout(500);
await shot("log-body-height-editor");
await page.getByRole("button", { name: "Done" }).click();
await page.waitForTimeout(300);

const genderRow = page.getByRole("button", { name: /^Gender/ }).first();
await genderRow.click();
await page.waitForTimeout(500);
await shot("log-body-gender-editor");
await genderRow.click();
await page.waitForTimeout(300);

// Nav clearance: does the floating pill cover the last row?
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(500);
await shot("log-body-nav-clearance", false);

// --- Metric units ---------------------------------------------------------
await page.evaluate(async () => {
  const { db } = await import("/src/db/db.ts");
  await db.settings.put({ key: "unit.length", value: "cm" });
  await db.settings.put({ key: "unit", value: "kg" });
});
await page.waitForTimeout(900);
await shot("log-body-metric-units");
await page.evaluate(async () => {
  const { db } = await import("/src/db/db.ts");
  await db.settings.put({ key: "unit.length", value: "in" });
  await db.settings.put({ key: "unit", value: "lb" });
});
await page.waitForTimeout(700);

// --- Redirect and Profile -------------------------------------------------
await page.goto(`${BASE}/profile/measurements`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
const redirected = new URL(page.url()).pathname;
console.log(`/profile/measurements -> ${redirected}`);
if (redirected !== "/log/body") errors.push(`bad redirect: ${redirected}`);

await page.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await shot("profile-account");

// --- Desktop --------------------------------------------------------------
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(`${BASE}/log`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await shot("log-daily-desktop");
await page.getByRole("link", { name: "Body" }).click();
await page.waitForTimeout(1000);
await shot("log-body-desktop");

// --- Reduced motion (same context, so the seeded data survives) -----------
await page.setViewportSize({ width: 390, height: 844 });
await page.emulateMedia({ reducedMotion: "reduce" });
await page.goto(`${BASE}/log`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await shot("log-reduced-motion");
await page.getByRole("button", { name: "Derived", exact: true }).click();
await page.waitForTimeout(600);
await shot("log-reduced-motion-derived", false);
await page.emulateMedia({ reducedMotion: "no-preference" });

await browser.close();

if (errors.length) {
  console.error("ERRORS:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("OK");
