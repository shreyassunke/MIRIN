import { chromium, devices } from "playwright";

async function exerciseNames(page) {
  return page
    .locator("[data-reorder-index]")
    .locator(".text-\\[17px\\]")
    .allTextContents();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...devices["iPhone 13"],
    locale: "en-US",
    hasTouch: true,
  });
  const page = await context.newPage();

  await page.goto("http://localhost:5173/today", { waitUntil: "networkidle" });
  await page.waitForSelector("[data-reorder-index]", { timeout: 15000 });

  const before = await exerciseNames(page);
  console.log("Before:", before);

  if (before.length < 3) {
    throw new Error(
      `Need at least 3 exercises to test reorder, got ${before.length}`,
    );
  }

  const source = page
    .locator('[data-reorder-index="0"] span[aria-hidden="true"]')
    .first();
  const target = page.locator('[data-reorder-index="2"]');

  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) {
    throw new Error("Could not measure drag handle or target row");
  }

  const startX = sourceBox.x + sourceBox.width / 2;
  const startY = sourceBox.y + sourceBox.height / 2;
  const endX = targetBox.x + targetBox.width / 2;
  const endY = targetBox.y + targetBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(1000);

  const after = await exerciseNames(page);
  console.log("After:", after);

  if (before[0] === after[0]) {
    throw new Error("Reorder did not move the first exercise on touch drag");
  }

  if (after[2] !== before[0]) {
    throw new Error(
      `Expected first exercise "${before[0]}" at index 2, got "${after[2]}"`,
    );
  }

  console.log("PASS: touch drag reorder works on iPhone emulation");
  await browser.close();
}

main().catch((error) => {
  console.error("FAIL:", error);
  process.exit(1);
});
