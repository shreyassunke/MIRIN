import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:5174";
const OUT = ".screenshots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const errors = [];
const failures = [];

const isAuthNoise = (text) =>
  /supabase|Failed to fetch|net::ERR|ERR_NAME_NOT_RESOLVED|Invalid Refresh Token|AuthApiError|status of 401/i.test(
    text,
  );

const expect = async (name, cond) => {
  if (!(await cond())) failures.push(name);
};

const stubUser = {
  id: "00000000-0000-4000-8000-000000000000",
  aud: "authenticated",
  role: "authenticated",
  email: "lifter@example.com",
  user_metadata: { full_name: "Verification Run" },
  app_metadata: {},
  created_at: new Date().toISOString(),
};

async function seedSession(page) {
  await page.route("**/auth/v1/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/user")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(stubUser),
      });
      return;
    }
    if (url.includes("/token")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "local-verification-token",
          token_type: "bearer",
          expires_in: 31536000,
          expires_at: Math.floor(Date.now() / 1000) + 31536000,
          refresh_token: "local-verification-refresh",
          user: stubUser,
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });

  await page.goto(`${BASE}/auth`, { waitUntil: "domcontentloaded" });
  const signedIn = await page.evaluate(async (user) => {
    const mod = await import("/src/lib/supabase.ts");
    if (!mod.isSupabaseConfigured) return false;
    const client = mod.getSupabase();
    const key = client?.auth?.storageKey;
    if (!key) return false;
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
  }, stubUser);
  if (!signedIn) {
    throw new Error(
      "Could not seed a session — start the dev server with Supabase env vars.",
    );
  }
}

async function run(name, viewport, extra, actions) {
  const context = await browser.newContext({
    viewport,
    ...extra,
  });
  const page = await context.newPage();
  page.on("pageerror", (err) => {
    if (!isAuthNoise(err.message)) errors.push(`${name}: ${err.message}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error" && !isAuthNoise(msg.text())) {
      errors.push(`${name} console: ${msg.text()}`);
    }
  });
  try {
    await actions(page);
  } catch (err) {
    await page
      .screenshot({ path: `${OUT}/weight-3d-${name}-error.png`, fullPage: true })
      .catch(() => {});
    throw err;
  } finally {
    await context.close();
  }
}

const mobile = { width: 390, height: 844 };
const desktop = { width: 1440, height: 900 };

const waitToday = async (page) => {
  await seedSession(page);
  await page.goto(`${BASE}/today`, { waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", { name: /^Log / })
    .first()
    .waitFor({ timeout: 15000 });
};

const waitBarbell = async (page) => {
  await waitToday(page);
  const addPlateBtn = page.getByRole("button", {
    name: /Add .* plate to each side/,
  });
  if (await addPlateBtn.count()) return;
  const barbellChip = page.getByRole("button", { name: "Barbell", exact: true });
  if (await barbellChip.count()) {
    await barbellChip.first().click();
    await page.waitForTimeout(300);
    if (await addPlateBtn.count()) return;
  }
  await page.getByRole("button", { name: /Chest|Push|Pull|Leg|Back/ }).first().click();
  const push = page.getByRole("option", { name: /^Push/ });
  if (await push.count()) {
    await push.click();
    const todayOnly = page.getByRole("button", { name: "Today only" });
    if (await todayOnly.count()) await todayOnly.click();
    await page.waitForTimeout(500);
  }
  if (await barbellChip.count()) await barbellChip.first().click();
  await addPlateBtn.first().waitFor({ timeout: 10000 });
};

const waitDumbbell = async (page) => {
  await waitToday(page);
  const dbChip = page.getByRole("button", { name: "Dumbbell", exact: true });
  if (await dbChip.count()) await dbChip.first().click();
  await page.getByRole("img", { name: /dumbbell/ }).waitFor({ timeout: 10000 });
};

const addPlate = (page, n) =>
  page.getByRole("button", { name: `Add ${n} lb plate to each side` }).click();

await run("barbell-empty-mobile", mobile, {}, async (page) => {
  await waitBarbell(page);
  const clear = page.getByRole("button", { name: "Clear" });
  if (await clear.count()) await clear.click();
  await page.waitForTimeout(400);
  await expect("empty bar label", () =>
    page.getByRole("img", { name: "Empty bar" }).isVisible(),
  );
  await page.screenshot({
    path: `${OUT}/weight-3d-barbell-empty-mobile.png`,
    fullPage: true,
  });
});

await run("barbell-mid-mobile", mobile, {}, async (page) => {
  await waitBarbell(page);
  await addPlate(page, "10");
  await page.waitForTimeout(400);
  await expect("mid-load label", () =>
    page.getByRole("img", { name: /Bar loaded with/ }).isVisible(),
  );
  await page.screenshot({
    path: `${OUT}/weight-3d-barbell-mid-mobile.png`,
    fullPage: true,
  });
});

await run("barbell-max-desktop", desktop, {}, async (page) => {
  await waitBarbell(page);
  for (const n of ["45", "35", "25", "10", "5", "2.5"]) {
    await addPlate(page, n);
  }
  await page.waitForTimeout(500);
  await page.screenshot({
    path: `${OUT}/weight-3d-barbell-max-desktop.png`,
    fullPage: true,
  });
  await page.getByRole("img", { name: /Bar loaded with|Empty bar/ }).screenshot({
    path: `${OUT}/weight-3d-barbell-max-close.png`,
  });
});

await run("dumbbell-light-mobile", mobile, {}, async (page) => {
  await waitDumbbell(page);
  const lateral = page.getByRole("button", { name: /Lateral Raise/ });
  if (await lateral.count()) await lateral.click();
  await page.waitForTimeout(400);
  await page.getByRole("option", { name: "2.5", exact: true }).click();
  await page.waitForTimeout(400);
  await expect("light dumbbell", () =>
    page.getByRole("img", { name: /2\.5 lb dumbbell/ }).isVisible(),
  );
  await page.screenshot({
    path: `${OUT}/weight-3d-dumbbell-light-mobile.png`,
    fullPage: true,
  });
});

await run("dumbbell-heavy-desktop", desktop, {}, async (page) => {
  await waitDumbbell(page);
  const lateral = page.getByRole("button", { name: /Lateral Raise/ });
  if (await lateral.count()) await lateral.click();
  await page.waitForTimeout(400);
  await page.getByRole("option", { name: "100", exact: true }).click();
  await page.waitForTimeout(400);
  await expect("heavy dumbbell", () =>
    page.getByRole("img", { name: /100 lb dumbbell/ }).isVisible(),
  );
  await page.screenshot({
    path: `${OUT}/weight-3d-dumbbell-heavy-desktop.png`,
    fullPage: true,
  });
  await page.getByRole("img", { name: /dumbbell/ }).screenshot({
    path: `${OUT}/weight-3d-dumbbell-heavy-close.png`,
  });
});

await run("reduced-motion", mobile, { reducedMotion: "reduce" }, async (page) => {
  await waitBarbell(page);
  await addPlate(page, "10");
  await page.waitForTimeout(300);
  await page.screenshot({
    path: `${OUT}/weight-3d-reduced-motion-mobile.png`,
    fullPage: true,
  });
});

await run("no-webgl", mobile, {}, async (page) => {
  await page.addInitScript(() => {
    const proto = HTMLCanvasElement.prototype;
    const orig = proto.getContext;
    proto.getContext = function (type, ...rest) {
      if (String(type).includes("webgl")) return null;
      return orig.call(this, type, ...rest);
    };
  });
  await waitBarbell(page);
  await expect("svg fallback present", () =>
    page.locator("svg[role='img']").first().isVisible(),
  );
  await page.screenshot({
    path: `${OUT}/weight-3d-no-webgl-mobile.png`,
    fullPage: true,
  });
});

await browser.close();

if (errors.length || failures.length) {
  if (errors.length) console.error("PAGE ERRORS:\n" + errors.join("\n"));
  if (failures.length)
    console.error("ASSERTION FAILURES:\n" + failures.join("\n"));
  process.exit(1);
}
console.log("OK: 3D weight instrument captures written to " + OUT);
