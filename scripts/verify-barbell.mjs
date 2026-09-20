// Pose check for the loaded-bar visualiser: captures it at the breakpoints and
// plate selections that matter, then asserts the properties the pose has to
// hold — mirror symmetry, a readable inner-face ellipse, and sleeve tips that
// stay clear of the stack.
//
// Run against a dev server started with stub Supabase env vars, since the
// Today pass needs a session:
//
//   $env:VITE_SUPABASE_URL="https://stub.supabase.co"
//   $env:VITE_SUPABASE_ANON_KEY="stub"
//   npx vite --port 5180
//   node scripts/verify-barbell.mjs
//
// Headless Chromium falls back to SwiftShader, whose swap chain the compositor
// cannot screenshot once a frame is presented. So this forces
// preserveDrawingBuffer on (test-side only, via an init script) and reads the
// canvas back with toDataURL rather than using page.screenshot.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:5180";
const OUT = ".screenshots/barbell";
const BACKDROP = "#111111";
mkdirSync(OUT, { recursive: true });

/** Harness cases. `bar` cases are measured; the rest are regression cover. */
const CASES = [
  { name: "w380-45x4", w: 380, plates: "45,45,45,45" },
  { name: "w1280-45x4", w: 1280, plates: "45,45,45,45" },
  { name: "w380-mixed", w: 380, plates: "45,35,25,10,5,2.5" },
  { name: "w1280-mixed", w: 1280, plates: "45,35,25,10,5,2.5" },
  { name: "w380-empty", w: 380, plates: "" },
  { name: "w1280-single", w: 1280, plates: "45" },
  { name: "w380-kg", w: 380, plates: "25,20,15,10", unit: "kg" },
  // These share the environment map, the light rig and the alongX helper.
  { name: "dumbbell", w: 220, plates: "30", what: "dumbbell" },
  { name: "rack", w: 380, plates: "", what: "rack" },
];

const FORCE_PRESERVE = () => {
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, attrs) {
    if (typeof type === "string" && type.startsWith("webgl")) {
      attrs = { ...(attrs ?? {}), preserveDrawingBuffer: true };
    }
    return orig.call(this, type, attrs);
  };
};

/**
 * Composites the live canvas onto the backdrop, then measures the pose off the
 * pixels. Runs in-page so nothing has to decode a PNG on the Node side.
 */
const GRAB = async ([selector, backdrop]) => {
  const canvas = document.querySelector(selector);
  if (!canvas) return null;
  // One more frame from the rest pose, then read it straight back.
  await new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r)),
  );
  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext("2d");
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(canvas, 0, 0);

  const w = out.width;
  const h = out.height;
  const { data } = ctx.getImageData(0, 0, w, h);
  const at = (x, y, c) => data[(y * w + x) * 4 + c];

  // Mirror symmetry: diff against the horizontal flip.
  let sum = 0;
  let over = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const mx = w - 1 - x;
      let worst = 0;
      for (let c = 0; c < 3; c++) {
        const d = Math.abs(at(x, y, c) - at(mx, y, c));
        sum += d;
        if (d > worst) worst = d;
      }
      // Anything past a quantisation step is real asymmetry, not AA noise.
      if (worst > 6) over++;
    }
  }
  const metrics = {
    flipMeanDiff: +(sum / (w * h * 3)).toFixed(4),
    flipPixelsOver6: +(over / (w * h)).toFixed(5),
    size: [w, h],
  };

  // Foreground against the backdrop, as a per-column vertical extent. The
  // backdrop is a flat 2D fill, so untouched pixels differ by exactly 0 and
  // the threshold only has to clear the contact shadow. It is kept low
  // because the unlit rim of a plate is nearly backdrop-dark, and a high
  // threshold erodes exactly the silhouette the ellipse is measured from.
  const bg = [17, 17, 17];
  const isFg = (x, y) =>
    Math.max(
      Math.abs(at(x, y, 0) - bg[0]),
      Math.abs(at(x, y, 1) - bg[1]),
      Math.abs(at(x, y, 2) - bg[2]),
    ) > 6;

  const top = new Int32Array(w).fill(-1);
  const bot = new Int32Array(w).fill(-1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++)
      if (isFg(x, y)) {
        if (top[x] < 0) top[x] = y;
        bot[x] = y;
      }
  }
  const height = Array.from({ length: w }, (_, x) =>
    top[x] < 0 ? 0 : bot[x] - top[x] + 1,
  );
  const cols = height.flatMap((v, x) => (v > 0 ? [x] : []));
  if (!cols.length) return { dataUrl: out.toDataURL("image/png"), metrics, empty: true };

  const x0 = cols[0];
  const x1 = cols[cols.length - 1];
  const plateH = Math.max(...height);
  Object.assign(metrics, {
    barSpanPx: x1 - x0 + 1,
    barMarginPx: [x0, w - 1 - x1],
    centredBy: x0 - (w - 1 - x1),
    plateHeightPx: plateH,
    // How tall the outermost visible column is. A sleeve tip is shaft-thin, so
    // this stays small unless the stack has overrun the end of the sleeve.
    tipHeightPx: height[x0],
  });

  // Inner-face ellipse of the left stack: x(y) = cx + a*sqrt(1-((y-cy)/b)^2).
  // The apex is noisy and biased, so sample where the radical is exactly 0.5 —
  // at y = cy +/- 0.866b — and solve a = 2*(x(cy) - x(that)).
  const tall = cols.filter((x) => height[x] > plateH * 0.55);
  const left = tall.filter((x) => x < w / 2);
  // Only meaningful when a stack was actually found: on a bare bar every
  // column clears the threshold, and there is no face to measure.
  if (left.length && left[left.length - 1] - left[0] < metrics.barSpanPx * 0.45) {
    const lx0 = left[0];
    const lx1 = left[left.length - 1];
    let yTop = h;
    let yBot = -1;
    for (let x = lx0; x <= lx1; x++) {
      if (top[x] >= 0) {
        yTop = Math.min(yTop, top[x]);
        yBot = Math.max(yBot, bot[x]);
      }
    }
    const rightEdge = (y) => {
      for (let x = lx1; x >= 0; x--) if (isFg(x, y)) return x;
      return -1;
    };
    const yMid = (yTop + yBot) >> 1;
    const off = Math.round(0.866 * ((yBot - yTop) / 2));
    // x(cy) - x(cy +/- 0.866b) = a - 0.5a, so the semi-minor axis is twice the
    // sampled drop, and the full minor axis is twice that again.
    const semiMinor =
      2 * (rightEdge(yMid) - (rightEdge(yMid - off) + rightEdge(yMid + off)) / 2);
    metrics.stackWidthPx = lx1 - lx0;
    metrics.ellipseMinorOverMajor = +((2 * semiMinor) / plateH).toFixed(4);
    metrics.impliedViewAngleDeg = +(
      (Math.asin(
        Math.min(1, Math.max(0, metrics.ellipseMinorOverMajor)),
      ) *
        180) /
      Math.PI
    ).toFixed(2);
  }
  return { dataUrl: out.toDataURL("image/png"), metrics };
};

const SESSION = {
  access_token: "local-verification-token",
  token_type: "bearer",
  expires_in: 31536000,
  expires_at: Math.floor(Date.now() / 1000) + 31536000,
  refresh_token: "local-verification-refresh",
  user: {
    id: "00000000-0000-4000-8000-000000000000",
    aud: "authenticated",
    role: "authenticated",
    email: "lifter@example.com",
    user_metadata: { full_name: "Verification Run" },
    app_metadata: {},
    created_at: new Date().toISOString(),
  },
};

// The stub Supabase host is unreachable by design; its failures are not defects.
const isStubNoise = (t) =>
  /stub\.supabase\.co|Failed to fetch|net::ERR|ERR_NAME_NOT_RESOLVED|401|403/i.test(
    t,
  );

const failures = [];
const check = (name, cond, detail) => {
  if (!cond) failures.push(`${name}: ${detail}`);
};

const browser = await chromium.launch({
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});

const newPage = async (width, height = 320, scale = 2) => {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: scale,
  });
  await page.addInitScript(FORCE_PRESERVE);
  const errors = [];
  page.on("pageerror", (e) => !isStubNoise(e.message) && errors.push(e.message));
  page.on(
    "console",
    (m) =>
      m.type() === "error" && !isStubNoise(m.text()) && errors.push(m.text()),
  );
  return { page, errors };
};

const barSpans = {};

// --- Harness pass: pose and symmetry across plate selections ---------------
for (const c of CASES) {
  const { page, errors } = await newPage(Math.max(c.w, 400));
  const url = `${BASE}/dev/barbell.html?w=${c.w}&plates=${c.plates}&unit=${c.unit ?? "lb"}&what=${c.what ?? "bar"}`;
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector("body[data-ready='1']", { timeout: 15000 });

  if (c.what === "rack") {
    await page.locator("#stage").screenshot({ path: `${OUT}/${c.name}.png` });
    console.log(`${c.name}: captured`);
  } else {
    const got = await page.evaluate(GRAB, ["#stage canvas", BACKDROP]);
    if (!got) {
      failures.push(`${c.name}: no canvas`);
    } else {
      writeFileSync(
        `${OUT}/${c.name}.png`,
        Buffer.from(got.dataUrl.split(",")[1], "base64"),
      );
      const m = got.metrics;
      console.log(`${c.name}: ${JSON.stringify(m)}`);
      if (!c.what || c.what === "bar") barSpans[c.name] = m.barSpanPx;

      // At rest the render must survive a horizontal flip.
      // A 1px allowance: the silhouette threshold can land either side of a
      // single antialiased column at the sleeve tip.
      check(c.name, Math.abs(m.centredBy) <= 1, `off-centre by ${m.centredBy}px`);
      // Loaded bars stamp readable numerals on both inner faces, so the
      // render is no longer a pixel-perfect horizontal flip.
      if (c.what === "dumbbell" || !c.plates) {
        check(
          c.name,
          m.flipPixelsOver6 <= 0.02,
          `${(m.flipPixelsOver6 * 100).toFixed(2)}% of pixels break mirror symmetry`,
        );
      }
      // Padding on both sides, and the whole bar inside the frame.
      check(
        c.name,
        m.barMarginPx?.[0] > 0 && m.barMarginPx?.[1] > 0,
        `bar touches the frame edge (margins ${m.barMarginPx})`,
      );
      if (c.what === "dumbbell") {
        // Same pose language as the bar: a readable inner-face ellipse.
        // Pixel estimate is loose; the exact figure is asserted from the
        // scene geometry further down.
        check(
          c.name,
          m.ellipseMinorOverMajor >= 0.05 && m.ellipseMinorOverMajor <= 0.28,
          `face ellipse is ${m.ellipseMinorOverMajor} of head height, want 0.05-0.28`,
        );
      } else if (c.plates) {
        // A narrow-but-present ellipse is the whole point of the pose. The
        // band is loose because the pixel estimate reads about a quarter
        // low — a plate's unlit rim fades into the backdrop, so the
        // silhouette erodes exactly where the ellipse is widest. The exact
        // figure is asserted from the scene geometry further down; this is
        // here to catch the pose collapsing to edge-on or swinging face-on.
        check(
          c.name,
          m.ellipseMinorOverMajor >= 0.1 && m.ellipseMinorOverMajor <= 0.35,
          `face ellipse is ${m.ellipseMinorOverMajor} of plate height, want 0.10-0.35`,
        );
        // The outermost column should be shaft-thin: a visible sleeve tip.
        check(
          c.name,
          m.tipHeightPx < m.plateHeightPx * 0.35,
          `sleeve tip is ${m.tipHeightPx}px against a ${m.plateHeightPx}px plate — stack has overrun it`,
        );
      }
    }
  }
  if (errors.length) failures.push(`${c.name}: ${errors.join(" | ")}`);
  await page.close();
}

{
  const name = "frame-stable";
  const empty = barSpans["w380-empty"];
  const loaded = barSpans["w380-45x4"];
  const single = barSpans["w1280-single"];
  const stacked = barSpans["w1280-45x4"];
  check(
    name,
    empty != null && loaded != null && Math.abs(empty - loaded) <= 2,
    `empty bar spans ${empty}px, loaded spans ${loaded}px — adding plates must not change the frame`,
  );
  check(
    name,
    single != null && stacked != null && Math.abs(single - stacked) <= 2,
    `one 45 spans ${single}px, four 45s span ${stacked}px — stack depth must not change the frame`,
  );
  console.log(
    `${name}: ${JSON.stringify({ empty, loaded, single, stacked })}`,
  );
}

// --- Today pass: the picker as it is actually wired up ---------------------
for (const width of [380, 1280]) {
  const name = `today-w${width}`;
  const { page, errors } = await newPage(width, 900, 1);

  await page.goto(`${BASE}/auth`, { waitUntil: "networkidle" });
  const signedIn = await page.evaluate(async (session) => {
    const mod = await import("/src/lib/supabase.ts");
    if (!mod.isSupabaseConfigured) return false;
    const key = mod.getSupabase()?.auth?.storageKey;
    if (!key) return false;
    localStorage.setItem(key, JSON.stringify(session));
    return true;
  }, SESSION);
  if (!signedIn) {
    console.error("no session — start the dev server with stub Supabase env vars");
    await browser.close();
    process.exit(1);
  }

  await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // Today may be a rest day, so add a barbell lift rather than assume one.
  const add = page.getByRole("button", { name: "Add exercise" });
  if (await add.count()) {
    await add.click();
    await page.getByPlaceholder("Search exercises").fill("Bench Press");
    await page.waitForTimeout(700);
    await page.getByRole("option").or(page.locator("li button")).first().click();
    await page.waitForTimeout(900);
  }
  if (!(await page.getByRole("group", { name: "Weight input method" }).count())) {
    await page.getByRole("button", { name: /Bench Press/i }).first().click();
    await page.waitForTimeout(700);
  }
  await page
    .getByRole("group", { name: "Weight input method" })
    .getByRole("button", { name: "Barbell" })
    .first()
    .click();
  await page.waitForTimeout(800);

  const plate = page.getByRole("button", { name: /^Add (45|20) / }).first();
  for (let i = 0; i < 4; i++) {
    await plate.click();
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(1400);

  const got = await page.evaluate(GRAB, ['[role="img"] canvas', BACKDROP]);
  if (!got) {
    failures.push(`${name}: no canvas on Today`);
  } else {
    writeFileSync(
      `${OUT}/${name}.png`,
      Buffer.from(got.dataUrl.split(",")[1], "base64"),
    );
    const m = got.metrics;
    console.log(`${name}: ${JSON.stringify(m)}`);
    check(name, Math.abs(m.centredBy) <= 1, `off-centre by ${m.centredBy}px`);
    check(
      name,
      m.tipHeightPx < m.plateHeightPx * 0.35,
      `sleeve tip is ${m.tipHeightPx}px against a ${m.plateHeightPx}px plate`,
    );
  }
  if (errors.length) failures.push(`${name}: ${errors.join(" | ")}`);
  await page.close();
}

// --- Pose maths: the ellipse the camera actually produces -----------------
// Read off the shipped constants rather than off pixels, so the requirement
// ("inner face 20-25% as wide as the plate is tall") is checked exactly.
{
  const name = "pose-geometry";
  const { page, errors } = await newPage(400);
  await page.goto(`${BASE}/dev/barbell.html?w=380&plates=45`, {
    waitUntil: "networkidle",
  });
  const pose = await page.evaluate(async () => {
    const s = await import("/src/components/weight/three/scale.ts");
    // Innermost plate face sits against the collar's outer face.
    const faceX = s.COLLAR_X + s.COLLAR_T / 2;
    const d = s.BAR_CAM_DISTANCE;
    return {
      faceX,
      cameraDistance: d,
      elevationDeg: s.BAR_CAM_ELEVATION_DEG,
      // Foreshortening of a disc whose normal is the bar axis: the cosine
      // between that axis and the eye ray, which is the ellipse's aspect.
      ellipseMinorOverMajor: +(faceX / Math.hypot(faceX, d)).toFixed(4),
    };
  });
  console.log(`${name}: ${JSON.stringify(pose)}`);
  check(
    name,
    pose.ellipseMinorOverMajor >= 0.2 && pose.ellipseMinorOverMajor <= 0.25,
    `inner face is ${pose.ellipseMinorOverMajor} as wide as tall, want 0.20-0.25`,
  );
  check(
    name,
    pose.elevationDeg >= 2 && pose.elevationDeg <= 4,
    `elevation is ${pose.elevationDeg} deg, want 2-4`,
  );
  if (errors.length) failures.push(`${name}: ${errors.join(" | ")}`);
  await page.close();
}

{
  const name = "pose-geometry-dumbbell";
  const { page, errors } = await newPage(400);
  await page.goto(`${BASE}/dev/barbell.html?w=220&plates=30&what=dumbbell`, {
    waitUntil: "networkidle",
  });
  const pose = await page.evaluate(async () => {
    const s = await import("/src/components/weight/three/scale.ts");
    const faceX = s.DB_OUTER_FACE_X;
    const d = s.DB_CAM_DISTANCE;
    return {
      faceX,
      cameraDistance: d,
      elevationDeg: s.DB_CAM_ELEVATION_DEG,
      ellipseMinorOverMajor: +(faceX / Math.hypot(faceX, d)).toFixed(4),
    };
  });
  console.log(`${name}: ${JSON.stringify(pose)}`);
  check(
    name,
    pose.ellipseMinorOverMajor >= 0.18 && pose.ellipseMinorOverMajor <= 0.22,
    `outer face is ${pose.ellipseMinorOverMajor} as wide as tall, want 0.18-0.22`,
  );
  check(
    name,
    pose.elevationDeg >= 1 && pose.elevationDeg <= 3,
    `elevation is ${pose.elevationDeg} deg, want 1-3`,
  );
  if (errors.length) failures.push(`${name}: ${errors.join(" | ")}`);
  await page.close();
}

// --- Parallax pass: small, model-preserving, and exactly reversible -------
{
  const name = "parallax";
  const { page, errors } = await newPage(500);
  await page.goto(`${BASE}/dev/barbell.html?w=380&plates=45,45,45,45`, {
    waitUntil: "networkidle",
  });
  await page.waitForSelector("body[data-ready='1']", { timeout: 15000 });

  const shot = async () => (await page.evaluate(GRAB, ["#stage canvas", BACKDROP])).dataUrl;
  // Real mouse moves: React synthesises onPointerLeave from pointerout /
  // pointerover, so a hand-dispatched "pointerleave" would be ignored.
  const box = await page.locator('#stage [role="img"]').boundingBox();

  const rest = await shot();
  await page.mouse.move(box.x + box.width / 2, box.y + 2); // top edge -> max tilt
  await page.waitForTimeout(700);
  const tilted = await shot();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height + 60); // leave
  await page.waitForTimeout(1200);
  const released = await shot();

  for (const [suffix, url] of [
    ["rest", rest],
    ["tilted", tilted],
    ["released", released],
  ]) {
    writeFileSync(
      `${OUT}/parallax-${suffix}.png`,
      Buffer.from(url.split(",")[1], "base64"),
    );
  }
  check(name, rest !== tilted, "pointer movement did not move the camera");
  check(
    name,
    rest === released,
    "release did not return to the byte-identical rest pose",
  );
  console.log(
    `${name}: ${JSON.stringify({ moves: rest !== tilted, returnsExactly: rest === released })}`,
  );
  if (errors.length) failures.push(`${name}: ${errors.join(" | ")}`);
  await page.close();
}

await browser.close();

if (failures.length) {
  console.error(`\n${failures.length} failure(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`\nAll pose checks passed. Screenshots in ${OUT}/`);
