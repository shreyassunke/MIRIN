// End-to-end verification of the split system + exercise library:
//  A. Fresh seed: default split active, /today matches legacy weekday logic,
//     default split read-only until unlocked.
//  B. Split editor: create custom split, add exercises via autocomplete
//     (library pick + create-custom), rest day, switch active, switch back.
//  C. Migration: a v3-shaped IndexedDB (weekSchedule, no isActive) upgrades
//     to v4 with rotation, active default split, and intact SetLog history.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:5175";
const OUT = ".screenshots";
mkdirSync(OUT, { recursive: true });

const WEEK_NAMES = ["Push", "Pull", "Legs", "Arms", "Chest & Back"];
const legacyExpectedDayName = (schedule, date = new Date()) => {
  const weekday = date.getDay();
  return weekday === 0 || weekday === 6 ? "Rest day" : schedule[weekday - 1];
};

const browser = await chromium.launch();
const failures = [];
const errors = [];

function watch(page) {
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
}
const expect = async (name, cond) => {
  try {
    if (!(await cond())) failures.push(name);
  } catch (e) {
    failures.push(`${name} (threw: ${e.message.split("\n")[0]})`);
  }
};

// ---------- Part A + B: fresh database ----------
{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  watch(page);

  await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const expectedToday = legacyExpectedDayName(WEEK_NAMES);
  await expect(`fresh /today shows "${expectedToday}"`, () =>
    page.getByRole("heading", { name: expectedToday }).isVisible(),
  );

  await page.goto(`${BASE}/split`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await expect("default split listed", () =>
    page.getByText("5-Day Rotation").first().isVisible(),
  );
  await expect("default split marked Default", () =>
    page.getByText("Current split — default").isVisible(),
  );
  await expect("default split marked Active", () =>
    page.getByText("Active", { exact: true }).isVisible(),
  );
  await expect("7-day rotation meta", () =>
    page.getByText("7-day rotation").isVisible(),
  );
  await expect("read-only: no reorder arrows", async () =>
    (await page.getByRole("button", { name: /Move slot 1 up/ }).count()) === 0,
  );
  await page.screenshot({ path: `${OUT}/split-default.png`, fullPage: true });

  // Unlock the default split.
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: "Unlock editing?" }).click();
  await page.waitForTimeout(300);
  await expect("unlocked: reorder arrows appear", () =>
    page.getByRole("button", { name: "Move slot 1 up" }).isVisible(),
  );
  await expect("unlocked label", () =>
    page.getByText("editing unlocked").isVisible(),
  );
  await page.getByRole("button", { name: "Done editing" }).click();
  await page.waitForTimeout(200);
  await expect("relocked after done", async () =>
    (await page.getByRole("button", { name: /Move slot 1 up/ }).count()) === 0,
  );

  // Create a custom split.
  await page.getByRole("button", { name: "Create new split" }).click();
  await page.getByLabel("New split name").fill("Upper Lower");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.waitForTimeout(400);
  await expect("custom split selected", () =>
    page.getByRole("heading", { name: "Upper Lower" }).isVisible(),
  );
  await expect("custom split has Day 1", () =>
    page.getByRole("heading", { name: "Day 1" }).isVisible(),
  );

  // Add a library exercise via autocomplete (keyboard path).
  await page.getByRole("button", { name: "Add exercise" }).click();
  await page.getByRole("combobox", { name: "Search exercises" }).fill("bench press");
  await page.waitForTimeout(400); // debounce + render
  await expect("autocomplete shows Barbell Bench Press with meta", () =>
    page
      .getByRole("option", { name: /Barbell Bench Press.*Barbell — Chest/s })
      .first()
      .isVisible(),
  );
  await page.screenshot({ path: `${OUT}/autocomplete.png`, fullPage: true });
  // The fullPage screenshot scrolls options under the pointer, which moves
  // the hover highlight; hover the target row to make the start state
  // deterministic, then exercise keyboard nav from there.
  await page
    .getByRole("option", { name: /Barbell Bench Press.*Barbell — Chest/s })
    .first()
    .hover();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  await expect("picked exercise added to day", () =>
    page.getByText("Barbell Bench Press").first().isVisible(),
  );

  // Create-custom flow from a no-match query.
  const box = page.getByRole("combobox", { name: "Search exercises" });
  await box.fill("Landmine Meadows Row");
  await page.waitForTimeout(400);
  await page.getByRole("option", { name: /Create custom exercise/ }).click();
  await page.waitForTimeout(300);
  await expect("create form prefilled", async () =>
    (await page.getByLabel("Name").inputValue()) === "Landmine Meadows Row",
  );
  await page.getByRole("button", { name: "Save exercise" }).click();
  await page.waitForTimeout(400);
  await expect("custom exercise added to day", () =>
    page.getByText("Landmine Meadows Row").first().isVisible(),
  );

  // Custom exercise is searchable afterwards.
  await box.fill("meadows");
  await page.waitForTimeout(400);
  await expect("custom exercise found in search, marked Added", () =>
    page.getByRole("option", { name: /Landmine Meadows Row.*Added/s }).isVisible(),
  );
  await box.press("Escape");

  // Rest day + day rename.
  await page.getByRole("button", { name: "Add rest day" }).click();
  await page.waitForTimeout(300);
  await expect("rest slot added", () =>
    page.getByText("Rest", { exact: true }).first().isVisible(),
  );
  await page.getByRole("button", { name: "Rename", exact: true }).last().click();
  await page.getByLabel("Day name").fill("Upper A");
  await page.getByLabel("Day name").press("Enter");
  await page.waitForTimeout(300);
  await expect("day renamed", () =>
    page.getByRole("heading", { name: "Upper A" }).isVisible(),
  );

  // Switch active to the custom split; /today follows.
  await page.getByRole("button", { name: "Make active" }).click();
  await page.waitForTimeout(400);
  await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await expect("/today shows custom split day", () =>
    page.getByRole("heading", { name: "Upper A" }).isVisible(),
  );
  await expect("/today lists picked exercise", () =>
    page.getByText("Barbell Bench Press").first().isVisible(),
  );
  await page.screenshot({ path: `${OUT}/today-custom.png`, fullPage: true });

  // Switch back to the default; original behavior returns.
  await page.goto(`${BASE}/split`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Make active" }).click();
  await page.waitForTimeout(400);
  await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await expect(`switch-back /today shows "${expectedToday}"`, () =>
    page.getByRole("heading", { name: expectedToday }).isVisible(),
  );

  // Delete the custom split (default remains undeletable: no Delete button).
  await page.goto(`${BASE}/split`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await expect("default has no Delete button", async () => {
    // Default is selected initially (active).
    return (await page.getByRole("button", { name: "Delete", exact: true }).count()) === 0;
  });
  await page.getByText("Upper Lower").click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete split?" }).click();
  await page.waitForTimeout(400);
  await expect("custom split deleted", async () =>
    (await page.getByText("Upper Lower").count()) === 0,
  );
  await expect("custom exercise history survives split deletion", async () => {
    await page.goto(`${BASE}/exercise/custom-landmine-meadows-row`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(500);
    return page
      .getByRole("heading", { name: "Landmine Meadows Row" })
      .isVisible();
  });

  await context.close();
}

// ---------- Part C: v3 -> v4 migration ----------
{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  watch(page);

  // Build a v3-shaped database (Dexie idb version = 3 * 10) BEFORE the app
  // opens it, with a custom weekSchedule order and real logged history.
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      const del = indexedDB.deleteDatabase("mirin");
      del.onsuccess = resolve;
      del.onerror = reject;
      del.onblocked = resolve;
    });
    await new Promise((resolve, reject) => {
      const req = indexedDB.open("mirin", 30);
      req.onupgradeneeded = () => {
        const idb = req.result;
        const ex = idb.createObjectStore("exercises", { keyPath: "id" });
        ex.createIndex("name", "name");
        ex.createIndex("priorityOrder", "priorityOrder");
        idb.createObjectStore("dayTemplates", { keyPath: "id" });
        idb.createObjectStore("splits", { keyPath: "id" });
        const se = idb.createObjectStore("sessions", { keyPath: "id" });
        se.createIndex("date", "date");
        se.createIndex("dayTemplateId", "dayTemplateId");
        const sl = idb.createObjectStore("setLogs", { keyPath: "id" });
        sl.createIndex("sessionId", "sessionId");
        sl.createIndex("exerciseId", "exerciseId");
        sl.createIndex("[exerciseId+sessionId]", ["exerciseId", "sessionId"]);
        idb.createObjectStore("exercisePrefs", { keyPath: "exerciseId" });
        idb.createObjectStore("settings", { keyPath: "key" });
      };
      req.onsuccess = () => {
        const idb = req.result;
        const tx = idb.transaction(
          ["exercises", "dayTemplates", "splits", "sessions", "setLogs"],
          "readwrite",
        );
        const days = [
          ["push", "Push", ["incline-barbell-press", "lateral-raise"]],
          ["pull", "Pull", ["barbell-row", "rear-delt-flye"]],
          ["legs", "Legs", ["squat", "rdl"]],
          ["arms", "Arms", ["barbell-curl", "skull-crusher"]],
          ["chest-back", "Chest & Back", ["incline-db-press", "cable-row"]],
        ];
        const exercises = {
          "incline-barbell-press": "Incline Barbell Press",
          "lateral-raise": "Lateral Raise",
          "barbell-row": "Barbell Row",
          "rear-delt-flye": "Rear Delt Flye",
          squat: "Squat",
          rdl: "RDL",
          "barbell-curl": "Barbell Curl",
          "skull-crusher": "Skull Crusher",
          "incline-db-press": "Incline DB Press",
          "cable-row": "Cable Row",
        };
        let order = 1;
        for (const [id, name] of Object.entries(exercises)) {
          tx.objectStore("exercises").add({
            id,
            name,
            muscleGroup: "x",
            priorityOrder: order++,
          });
        }
        for (const [id, name, exerciseIds] of days) {
          tx.objectStore("dayTemplates").add({ id, name, exerciseIds });
        }
        // Custom weekday order: user had moved Pull to Monday.
        tx.objectStore("splits").add({
          id: "ppl-arms-cb",
          name: "5-Day Rotation",
          dayTemplateIds: ["push", "pull", "legs", "arms", "chest-back"],
          weekSchedule: ["pull", "push", "legs", "arms", "chest-back"],
        });
        tx.objectStore("sessions").add({
          id: "old-session",
          date: "2026-07-01T10:00:00.000Z",
          dayTemplateId: "push",
          completed: true,
        });
        tx.objectStore("setLogs").add({
          id: "old-set",
          sessionId: "old-session",
          exerciseId: "lateral-raise",
          setNumber: 1,
          weight: 20,
          reps: 12,
        });
        tx.oncomplete = () => {
          idb.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  });

  await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const migratedWeek = ["Pull", "Push", "Legs", "Arms", "Chest & Back"];
  const expectedMigrated = legacyExpectedDayName(migratedWeek);
  await expect(`migrated /today shows "${expectedMigrated}"`, () =>
    page.getByRole("heading", { name: expectedMigrated }).isVisible(),
  );

  await page.goto(`${BASE}/split`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await expect("migrated split is Default + Active", async () =>
    (await page.getByText("Current split — default").isVisible()) &&
    (await page.getByText("Active", { exact: true }).isVisible()),
  );
  await expect("migrated rotation is 7 slots", () =>
    page.getByText("7-day rotation").isVisible(),
  );
  await expect("migrated rotation preserves custom Monday=Pull", async () => {
    const rows = await page
      .getByRole("listitem")
      .filter({ hasText: /^Mon/ })
      .allTextContents();
    return rows.some((t) => t.includes("Pull"));
  });
  await page.screenshot({ path: `${OUT}/split-migrated.png`, fullPage: true });

  // SetLog history for lateral-raise survives the migration untouched.
  await page.goto(`${BASE}/exercise/lateral-raise`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await expect("migrated history intact (20×12)", () =>
    page.getByText("20×12").first().isVisible(),
  );

  await context.close();
}

await browser.close();

if (errors.length || failures.length) {
  if (errors.length) console.error("PAGE ERRORS:\n" + errors.join("\n"));
  if (failures.length)
    console.error("ASSERTION FAILURES:\n" + failures.join("\n"));
  process.exit(1);
}
console.log("OK: all split/library assertions passed");
