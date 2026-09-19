// Builds src/data/exercises.json from the free-exercise-db dataset
// (github.com/yuhonas/free-exercise-db). Run manually when refreshing the
// library: `npm run build:exercises`. The output is committed so the app
// stays fully offline with no runtime fetch.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_PATH = join(ROOT, "src", "data", "exercises.json");
const CACHE_PATH = join(ROOT, "node_modules", ".cache", "free-exercise-db.json");

const slug = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * Seated lat-pulldown stations are machines, even when the dataset tags
 * them as cable. Straight-arm variants stay cable.
 */
const LAT_PULLDOWN_MACHINE_IDS = new Set([
  "close-grip-front-lat-pulldown",
  "full-range-of-motion-lat-pulldown",
  "lat-pulldown",
  "one-arm-lat-pulldown",
  "v-bar-pulldown",
  "wide-grip-pulldown",
  "wide-grip-pulldown-behind-the-neck",
  "underhand-cable-pulldowns",
]);

/** Dataset equipment -> the app's equipment enum. */
const EQUIPMENT_MAP = {
  "body only": "bodyweight",
  kettlebells: "kettlebell",
  bands: "band",
  "e-z curl bar": "barbell",
  "medicine ball": "other",
  "exercise ball": "other",
  "foam roll": "other",
  other: "other",
  machine: "machine",
  cable: "cable",
  dumbbell: "dumbbell",
  barbell: "barbell",
};

/**
 * Existing seeded exercises (matched by raw dataset name) keep their original
 * ids so SetLog history stays linked. Name becomes the app's familiar name;
 * the dataset name is preserved as an alias automatically.
 */
const SEED_MATCHES = {
  "Barbell Incline Bench Press - Medium Grip": {
    id: "incline-barbell-press",
    name: "Incline Barbell Press",
    aliases: ["Incline Bench Press"],
  },
  "Barbell Shoulder Press": {
    id: "overhead-press",
    name: "Overhead Press",
    aliases: ["OHP"],
  },
  "Side Lateral Raise": {
    id: "lateral-raise",
    name: "Lateral Raise",
    aliases: ["Dumbbell Lateral Raise"],
  },
  "Dumbbell Bench Press": {
    id: "flat-db-press",
    name: "Flat DB Press",
    aliases: ["Flat Dumbbell Press"],
  },
  "Triceps Pushdown": {
    id: "tricep-pushdown",
    name: "Tricep Pushdown",
    aliases: ["Cable Pushdown"],
  },
  "Wide-Grip Lat Pulldown": {
    id: "wide-grip-pulldown",
    name: "Wide-Grip Pulldown",
    aliases: [],
  },
  "Bent Over Barbell Row": {
    id: "barbell-row",
    name: "Barbell Row",
    aliases: ["Bent-Over Row"],
  },
  "Reverse Flyes": {
    id: "rear-delt-flye",
    name: "Rear Delt Flye",
    aliases: ["Reverse Fly", "Rear Delt Fly"],
  },
  "Face Pull": { id: "face-pull", name: "Face Pull", aliases: [] },
  "Barbell Curl": {
    id: "barbell-curl",
    name: "Barbell Curl",
    aliases: ["Standing Barbell Curl"],
  },
  "Barbell Squat": {
    id: "squat",
    name: "Squat",
    aliases: ["Back Squat"],
  },
  "Romanian Deadlift": {
    id: "rdl",
    name: "RDL",
    aliases: [],
  },
  "Leg Press": { id: "leg-press", name: "Leg Press", aliases: [] },
  "Lying Leg Curls": {
    id: "leg-curl",
    name: "Leg Curl",
    aliases: ["Lying Leg Curl"],
  },
  "Standing Calf Raises": {
    id: "calf-raise",
    name: "Calf Raise",
    aliases: ["Standing Calf Raise"],
  },
  "EZ-Bar Skullcrusher": {
    id: "skull-crusher",
    name: "Skull Crusher",
    aliases: ["Skullcrusher", "Lying Triceps Press"],
  },
  "Hammer Curls": {
    id: "hammer-curl",
    name: "Hammer Curl",
    aliases: ["Dumbbell Hammer Curl"],
  },
  "Incline Dumbbell Press": {
    id: "incline-db-press",
    name: "Incline DB Press",
    aliases: ["Incline Dumbbell Bench Press"],
  },
  "Cable Crossover": {
    id: "cable-fly",
    name: "Cable Fly",
    aliases: ["Cable Chest Fly"],
  },
  "Seated Cable Rows": {
    id: "cable-row",
    name: "Cable Row",
    aliases: ["Seated Cable Row"],
  },
};

/**
 * Input method hints for seed-matched ids mirror the app's existing
 * DEFAULT_INPUT_METHOD so first-open behavior is unchanged.
 */
const SEED_INPUT_HINTS = {
  "incline-barbell-press": "barbell",
  "overhead-press": "barbell",
  "barbell-row": "barbell",
  "barbell-curl": "barbell",
  squat: "barbell",
  rdl: "barbell",
  "skull-crusher": "barbell",
  "flat-db-press": "dumbbell",
  "incline-db-press": "dumbbell",
  "lateral-raise": "dumbbell",
  "hammer-curl": "dumbbell",
  "rear-delt-flye": "dumbbell",
};

/**
 * Seeded exercises with no unambiguous dataset twin stay as standalone
 * library entries (ids preserved, history intact).
 */
const EXTRA_ENTRIES = [
  {
    id: "lat-pulldown",
    name: "Lat Pulldown",
    aliases: ["Machine Lat Pulldown"],
    category: "bodybuilding",
    equipment: "machine",
    primaryMuscles: ["lats"],
    secondaryMuscles: ["biceps", "middle back"],
    inputMethodHint: "manual",
  },
  {
    id: "overhead-tricep-extension",
    name: "Overhead Tricep Extension",
    aliases: ["Overhead Triceps Extension"],
    category: "bodybuilding",
    equipment: "other",
    primaryMuscles: ["triceps"],
    secondaryMuscles: [],
    inputMethodHint: "manual",
  },
  {
    id: "single-arm-cable-lateral-raise",
    name: "Single-Arm Cable Lateral Raise",
    aliases: ["One-Arm Cable Lateral Raise", "Cable Single-Arm Lateral Raise"],
    category: "bodybuilding",
    equipment: "cable",
    primaryMuscles: ["shoulders"],
    secondaryMuscles: [],
    inputMethodHint: "manual",
  },
  {
    id: "single-arm-tricep-pushdown",
    name: "Single-Arm Tricep Pushdown",
    aliases: ["One-Arm Tricep Pushdown", "Single-Arm Pushdown"],
    category: "bodybuilding",
    equipment: "cable",
    primaryMuscles: ["triceps"],
    secondaryMuscles: [],
    inputMethodHint: "manual",
  },
  {
    id: "single-arm-face-pull",
    name: "Single-Arm Face Pull",
    aliases: ["One-Arm Face Pull"],
    category: "bodybuilding",
    equipment: "cable",
    primaryMuscles: ["shoulders"],
    secondaryMuscles: ["middle back"],
    inputMethodHint: "manual",
  },
  {
    id: "single-arm-hammer-curl",
    name: "Single-Arm Hammer Curl",
    aliases: ["One-Arm Hammer Curl"],
    category: "bodybuilding",
    equipment: "dumbbell",
    primaryMuscles: ["biceps"],
    secondaryMuscles: ["forearms"],
    inputMethodHint: "dumbbell",
  },
  {
    id: "single-arm-incline-press",
    name: "Single-Arm Incline Press",
    aliases: ["One-Arm Incline Dumbbell Press", "Single-Arm Incline DB Press"],
    category: "bodybuilding",
    equipment: "dumbbell",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["shoulders", "triceps"],
    inputMethodHint: "dumbbell",
  },
  {
    id: "single-arm-rdl",
    name: "Single-Arm RDL",
    aliases: ["Suitcase Deadlift", "One-Arm Romanian Deadlift"],
    category: "bodybuilding",
    equipment: "dumbbell",
    primaryMuscles: ["hamstrings"],
    secondaryMuscles: ["glutes", "lower back"],
    inputMethodHint: "dumbbell",
  },
  {
    id: "single-arm-farmer-carry",
    name: "Single-Arm Farmer Carry",
    aliases: ["Suitcase Carry", "One-Arm Farmer Walk"],
    category: "bodybuilding",
    equipment: "dumbbell",
    primaryMuscles: ["forearms"],
    secondaryMuscles: ["abdominals", "glutes", "traps"],
    inputMethodHint: "dumbbell",
  },
  {
    id: "landmine-press",
    name: "Landmine Press",
    aliases: ["Single-Arm Landmine Press", "One-Arm Landmine Press"],
    category: "bodybuilding",
    equipment: "barbell",
    primaryMuscles: ["shoulders"],
    secondaryMuscles: ["chest", "triceps"],
    inputMethodHint: "barbell",
  },
  {
    id: "single-arm-chest-press",
    name: "Single-Arm Chest Press",
    aliases: ["One-Arm Machine Chest Press", "Single-Arm Machine Press"],
    category: "bodybuilding",
    equipment: "machine",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["shoulders", "triceps"],
    inputMethodHint: "manual",
  },
  {
    id: "single-arm-cable-rear-delt",
    name: "Single-Arm Cable Rear Delt",
    aliases: ["One-Arm Rear Delt Fly", "Single-Arm Rear Delt Fly"],
    category: "bodybuilding",
    equipment: "cable",
    primaryMuscles: ["shoulders"],
    secondaryMuscles: [],
    inputMethodHint: "manual",
  },
  {
    id: "single-arm-cable-row",
    name: "Single-Arm Cable Row",
    aliases: ["One-Arm Cable Row"],
    category: "bodybuilding",
    equipment: "cable",
    primaryMuscles: ["middle back"],
    secondaryMuscles: ["biceps", "lats"],
    inputMethodHint: "manual",
  },
];

/** Common shorthand merged as aliases, keyed by post-cleanup name. */
const CURATED_ALIASES = {
  "Barbell Bench Press": ["Bench Press", "Flat Bench"],
  "Barbell Deadlift": ["Deadlift", "Conventional Deadlift"],
  "Standing Military Press": ["Military Press"],
  Pullups: ["Pull-Up", "Pull Up"],
  Pushups: ["Push-Up", "Push Up"],
  "Chin-Up": ["Chinup"],
  "Dips - Triceps Version": ["Tricep Dips", "Dips"],
  "Barbell Hip Thrust": ["Hip Thrust"],
  "Barbell Lunge": ["Lunge"],
  "Seated Dumbbell Press": ["Dumbbell Overhead Press"],
  "One-Arm Side Laterals": ["Single-Arm Lateral Raise", "One-Arm Lateral Raise"],
  "Seated One-arm Cable Pulley Rows": ["One-Arm Seated Cable Row"],
  "Standing One-Arm Cable Curl": ["Single-Arm Cable Curl", "One-Arm Cable Curl"],
  "One-Arm Dumbbell Row": ["Single-Arm Dumbbell Row", "Single-Arm Row"],
  "Dumbbell One-Arm Shoulder Press": [
    "Single-Arm Shoulder Press",
    "One-Arm Shoulder Press",
  ],
  "Cable One Arm Tricep Extension": ["Single-Arm Cable Tricep Extension"],
  "One Arm Lat Pulldown": ["Single-Arm Lat Pulldown", "One-Arm Pulldown"],
  "One Arm Dumbbell Bench Press": ["Single-Arm Dumbbell Bench Press"],
  "Single-Arm Cable Crossover": ["Single-Arm Cable Fly", "One-Arm Cable Fly"],
  "Tricep Dumbbell Kickback": ["Single-Arm Tricep Kickback", "One-Arm Kickback"],
};

/** Grip qualifiers folded into aliases rather than kept in the display name. */
const NAME_CLEANUPS = [/\s*-\s*Medium Grip$/i];

function cleanName(raw) {
  let name = raw.replace(/\s+/g, " ").trim();
  for (const pattern of NAME_CLEANUPS) name = name.replace(pattern, "");
  return name;
}

function normalizeCategory(category, equipment) {
  if (category === "strength" || category === "plyometrics") {
    return equipment === "bodyweight" ? "calisthenics" : "bodybuilding";
  }
  return category; // powerlifting, olympic weightlifting, cardio, stretching, strongman
}

function inputMethodHint(rawEquipment) {
  if (rawEquipment === "barbell" || rawEquipment === "e-z curl bar") {
    return "barbell";
  }
  if (rawEquipment === "dumbbell") return "dumbbell";
  return "manual";
}

async function loadDataset() {
  if (existsSync(CACHE_PATH)) {
    console.log(`Using cached dataset: ${CACHE_PATH}`);
    return JSON.parse(readFileSync(CACHE_PATH, "utf8"));
  }
  console.log(`Fetching ${SOURCE_URL}`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const text = await res.text();
  mkdirSync(dirname(CACHE_PATH), { recursive: true });
  writeFileSync(CACHE_PATH, text);
  return JSON.parse(text);
}

const dataset = await loadDataset();
const entries = [];
const byId = new Map();
const byName = new Map(); // lowercased display name -> entry (dedup)
const matchedSeeds = new Set();

function addAliases(entry, aliases) {
  for (const alias of aliases) {
    if (
      alias &&
      alias.toLowerCase() !== entry.name.toLowerCase() &&
      !entry.aliases.some((a) => a.toLowerCase() === alias.toLowerCase())
    ) {
      entry.aliases.push(alias);
    }
  }
}

for (const raw of dataset) {
  const rawName = raw.name.replace(/\s+/g, " ").trim();
  const seedMatch = SEED_MATCHES[rawName];
  let equipment = EQUIPMENT_MAP[raw.equipment ?? "other"] ?? "other";

  const name = seedMatch ? seedMatch.name : cleanName(rawName);
  const id = seedMatch ? seedMatch.id : slug(name);
  if (seedMatch) matchedSeeds.add(rawName);
  if (LAT_PULLDOWN_MACHINE_IDS.has(id)) equipment = "machine";

  const aliases = [];
  if (rawName.toLowerCase() !== name.toLowerCase()) aliases.push(rawName);
  if (seedMatch) aliases.push(...seedMatch.aliases);
  aliases.push(...(CURATED_ALIASES[name] ?? []));

  const entry = {
    id,
    name,
    aliases: [],
    category: normalizeCategory(raw.category, equipment),
    equipment,
    primaryMuscles: raw.primaryMuscles ?? [],
    secondaryMuscles: raw.secondaryMuscles ?? [],
    inputMethodHint: seedMatch
      ? (SEED_INPUT_HINTS[id] ?? "manual")
      : inputMethodHint(raw.equipment),
  };
  addAliases(entry, aliases);

  // Near-identical names collapse into one entry; phrasing differences merge
  // as aliases and muscle lists union.
  const existing = byName.get(name.toLowerCase()) ?? byId.get(id);
  if (existing) {
    addAliases(existing, [rawName, ...aliases]);
    for (const muscle of entry.secondaryMuscles) {
      if (
        !existing.secondaryMuscles.includes(muscle) &&
        !existing.primaryMuscles.includes(muscle)
      ) {
        existing.secondaryMuscles.push(muscle);
      }
    }
    continue;
  }

  entries.push(entry);
  byId.set(id, entry);
  byName.set(name.toLowerCase(), entry);
}

for (const extra of EXTRA_ENTRIES) {
  if (byId.has(extra.id)) {
    console.warn(`Extra entry collides with dataset id, skipped: ${extra.id}`);
    continue;
  }
  entries.push(extra);
  byId.set(extra.id, extra);
}

// --- Verification -----------------------------------------------------------
const unmatchedSeeds = Object.keys(SEED_MATCHES).filter(
  (n) => !matchedSeeds.has(n),
);
if (unmatchedSeeds.length) {
  throw new Error(
    `Seed matches not found in dataset:\n  ${unmatchedSeeds.join("\n  ")}`,
  );
}
const unknownAliasKeys = Object.keys(CURATED_ALIASES).filter(
  (n) => !byName.has(n.toLowerCase()),
);
if (unknownAliasKeys.length) {
  console.warn(`Curated alias keys with no entry: ${unknownAliasKeys.join(", ")}`);
}
const SEED_IDS = [
  ...new Set([
    ...Object.values(SEED_MATCHES).map((s) => s.id),
    ...EXTRA_ENTRIES.map((e) => e.id),
  ]),
];
for (const id of SEED_IDS) {
  if (!byId.has(id)) throw new Error(`Seed id missing from library: ${id}`);
}

entries.sort((a, b) => a.name.localeCompare(b.name));

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(
  OUT_PATH,
  "[\n" + entries.map((e) => JSON.stringify(e)).join(",\n") + "\n]\n",
);
console.log(
  `Wrote ${entries.length} exercises (${SEED_IDS.length} seed-matched) to ${OUT_PATH}`,
);
