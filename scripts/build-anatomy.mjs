/**
 * Pulls the muscle outlines MIRIN needs out of the flutter-body-atlas SVGs
 * (art by Ryan Graves, CC BY 4.0) and writes them as a generated module.
 *
 * Only outlines ship. Fascicles are generated at runtime from these paths so
 * the striation is derived from the real silhouette rather than drawn beside it.
 *
 * Needs the atlas checked out alongside:
 *   git clone https://github.com/kit-g/flutter-body-atlas .atlas
 */
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";

/** Plate aspect. Crops are expanded to this so the panel never resizes. */
const ASPECT = 1.55;

/**
 * Which atlas paths carry the fascicles, per region, and the window each one
 * is seen through. Long muscles are trimmed by the window rather than zoomed
 * out to fit, so every plate shows tissue at a comparable scale.
 */
const REGIONS = {
  chest: {
    view: "front",
    belly: ["pectoralis_major_l"],
    box: [238, 196, 205, 132],
  },
  lats: {
    view: "back",
    belly: ["latissimus_dorsi_l"],
    box: [107, 280, 264, 170],
  },
  traps: {
    view: "back",
    belly: ["trapezius_middle_l"],
    // Upper and lower are overlays on the same outline, so they name bundles
    // rather than adding geometry.
    parts: ["trapezius_upper_l", "trapezius_lower_l"],
    box: [150, 122, 300, 194],
  },
  glutes: {
    view: "back",
    belly: ["gluteus_maximus_l"],
    box: [112, 450, 272, 175],
  },
  triceps: {
    view: "back",
    belly: [
      "triceps_brachii_caput_laterale_l",
      "triceps_brachii_caput_longum_l",
      "triceps_brachii_caput_mediale_l",
    ],
    box: [80, 235, 175, 113],
  },
  "front-delt": {
    view: "front",
    belly: ["anterior_deltoid_l"],
    box: [318, 186, 180, 116],
  },
  "side-delt": {
    view: "front",
    belly: ["lateral_deltoid_l"],
    box: [318, 183, 180, 116],
  },
  "rear-delt": {
    view: "back",
    belly: ["posterior_deltoid_l"],
    box: [105, 180, 170, 110],
  },
  quads: {
    view: "front",
    belly: ["vastus_lateralis_l", "rectus_femoris_l", "vastus_medialis_l"],
    box: [312, 556, 196, 126],
  },
  calves: {
    view: "back",
    belly: ["gastrocnemius_l"],
    box: [120, 780, 260, 168],
  },
  biceps: {
    view: "front",
    belly: ["biceps_brachii_caput_longum_l", "biceps_brachii_caput_breve_l"],
    box: [378, 235, 175, 113],
  },
  hamstrings: {
    view: "back",
    belly: ["biceps_femoris_l", "semitendinosus_l", "semimembranosus_1_l"],
    box: [175, 620, 215, 139],
  },
  forearms: {
    view: "front",
    belly: [
      "brachioradialis_r",
      "flexor_carpi_radialis_r",
    ],
    box: [20, 350, 205, 132],
  },
  abs: {
    view: "front",
    belly: [
      "rectus_abdominis_4_l",
      "rectus_abdominis_4_r",
      "rectus_abdominis_2_l",
      "rectus_abdominis_2_r",
      "rectus_abdominis_3_l",
      "rectus_abdominis_3_r",
      "rectus_abdominis_1",
    ],
    box: [205, 290, 180, 116],
  },
  // The atlas draws no erector spinae. The lumbar column is the gap the
  // neighbours leave, so a plain lozenge under them resolves to the real
  // shape once latissimus, obliques, trapezius, and glutes paint on top.
  "lower-back": {
    view: "back",
    bellyShape: "M234 300 Q296 284 358 300 Q366 392 362 478 Q296 496 230 478 Q226 392 234 300 Z",
    box: [180, 280, 230, 148],
  },
};

const SKIP = /^(underlayer|face|platysma|sternohyoid|palm_|wrist_|hand_|foot_|ankle_)/;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1400 } });

const views = {};
for (const view of ["front", "back"]) {
  const svg = readFileSync(`.atlas/assets/svg/muscle_layer_${view}.svg`, "utf8");
  await page.setContent(`<body style="margin:0">${svg}</body>`);
  views[view] = await page.evaluate(() => {
    const root = document.querySelector("svg");
    const round = (d) =>
      d.replace(/-?\d+\.\d+/g, (n) => String(Math.round(Number(n) * 10) / 10));
    return Array.from(root.querySelectorAll("path[id]")).map((n, order) => {
      const b = n.getBBox();
      return {
        id: n.id,
        order,
        d: round(n.getAttribute("d").replace(/\s+/g, " ").trim()),
        box: [b.x, b.y, b.width, b.height],
      };
    });
  });
}

const overlaps = (a, b) =>
  a[0] < b[0] + b[2] && a[0] + a[2] > b[0] && a[1] < b[1] + b[3] && a[1] + a[3] > b[1];

const used = { front: new Set(), back: new Set() };
const regionOut = {};

for (const [region, cfg] of Object.entries(REGIONS)) {
  const items = views[cfg.view];
  const bellyIds = cfg.belly ?? [];
  const bellyItems = bellyIds.map((id) => {
    const hit = items.find((i) => i.id === id);
    if (!hit) throw new Error(`${region}: no atlas path "${id}"`);
    return hit;
  });

  // The authored window, nudged to the exact plate aspect.
  let [x, y, w, h] = cfg.box;
  if (w / h < ASPECT) {
    const want = h * ASPECT;
    x -= (want - w) / 2;
    w = want;
  } else {
    const want = w / ASPECT;
    y -= (want - h) / 2;
    h = want;
  }
  const crop = [x, y, w, h].map((v) => Math.round(v * 10) / 10);

  const parts = cfg.parts ?? [];
  const context = items
    .filter(
      (i) =>
        !bellyIds.includes(i.id) &&
        !parts.includes(i.id) &&
        !SKIP.test(i.id) &&
        overlaps(i.box, crop),
    )
    .sort((a, b) => a.order - b.order);

  for (const i of [...bellyItems, ...context]) used[cfg.view].add(i.id);
  for (const id of parts) used[cfg.view].add(id);

  // Keep the atlas's own stacking: neighbours it draws before the belly go
  // under, the rest go over, so overlaps read the way the plate does.
  const bellyOrder = bellyItems.length
    ? Math.min(...bellyItems.map((i) => i.order))
    : Infinity;
  regionOut[region] = {
    view: cfg.view,
    crop,
    belly: bellyIds,
    bellyShape: cfg.bellyShape,
    parts,
    under: context.filter((i) => i.order < bellyOrder).map((i) => i.id),
    over: context.filter((i) => i.order > bellyOrder).map((i) => i.id),
  };
}

// One shared path dictionary per view; regions reference ids.
const paths = {};
let bytes = 0;
for (const view of ["front", "back"]) {
  paths[view] = {};
  for (const item of views[view]) {
    if (!used[view].has(item.id)) continue;
    paths[view][item.id] = item.d;
    bytes += item.d.length;
  }
}

const lines = [];
lines.push(`/**
 * Generated by scripts/build-anatomy.mjs — do not edit by hand.
 *
 * Muscle outlines traced from the flutter-body-atlas anterior and posterior
 * plates. Artwork by Ryan Graves, used under CC BY 4.0:
 * https://www.figma.com/community/file/1320468164820924031
 */

export type AtlasView = "front" | "back";

export interface AtlasRegion {
  view: AtlasView;
  /** Window onto the plate, in atlas coordinates. */
  crop: [number, number, number, number];
  /** Outlines the fascicles live inside. */
  belly: string[];
  /** Stand-in outline where the atlas draws no muscle. */
  bellyShape?: string;
  /** Sub-outlines that name bundles without adding geometry. */
  parts: string[];
  /** Neighbours the atlas draws behind the belly. */
  under: string[];
  /** Neighbours the atlas draws in front of it. */
  over: string[];
}
`);

for (const view of ["front", "back"]) {
  lines.push(
    `export const ${view.toUpperCase()}_PATHS: Record<string, string> = ${JSON.stringify(paths[view], null, 1)};\n`,
  );
}
lines.push(
  `export const ATLAS_REGIONS: Record<string, AtlasRegion> = ${JSON.stringify(regionOut, null, 1)};\n`,
);

writeFileSync("src/lib/anatomy.generated.ts", lines.join("\n"));
console.log(
  `paths: ${Object.keys(paths.front).length} front + ${Object.keys(paths.back).length} back, ${(bytes / 1024).toFixed(1)} KB of d`,
);
for (const [r, v] of Object.entries(regionOut)) {
  console.log(`${r.padEnd(12)} ${v.view.padEnd(5)} crop=${v.crop.join(",")} ctx=${v.context.length}`);
}
await browser.close();
