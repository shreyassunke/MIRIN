/**
 * Bake one GLB shell and a fascicle polyline buffer per training region.
 *
 * Surfaces come from BodyParts3D 4.0 (99% OBJ). Fiber directions are a
 * Laplacian-style origin→insertion field on that geometry — the method
 * Alvar and Choi & Blemker use — constrained by the pennation and Lf/Lm
 * values already stored on MUSCLES.
 *
 * Needs `.tmp-assets/bp3d/isa_BP3D_4.0_obj_99.zip` and
 * `.tmp-assets/bp3d/isa_element_parts.txt`.
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BP3D = join(ROOT, ".tmp-assets", "bp3d");
const ZIP = join(BP3D, "isa_BP3D_4.0_obj_99.zip");
const MAP = join(BP3D, "isa_element_parts.txt");
const OBJ_DIR = join(BP3D, "obj");
const OUT = join(ROOT, "public", "models", "fibers");

const SEEDS = 96;
const TUBE_PTS = 10;
const MIN_LEN = 0.018;

/** Prefer the mirrored (left) element file when one exists. */
function loadFileMap() {
  const byName = new Map();
  for (const line of readFileSync(MAP, "utf8").split(/\r?\n/)) {
    const m = line.match(/^(FMA\d+)\s+(.+?)\s+(FJ\S+)\s*$/);
    if (!m) continue;
    const [, fma, name, file] = m;
    const key = name.toLowerCase();
    const list = byName.get(key) ?? [];
    list.push({ fma, file });
    byName.set(key, list);
  }
  return byName;
}

function pickFile(byName, name) {
  const list = byName.get(name.toLowerCase());
  if (!list?.length) return null;
  const mirrored = list.find((e) => e.file.endsWith("M"));
  return (mirrored ?? list[0]).file;
}

/**
 * BodyParts3D is millimetres, Z-up. Three.js wants metres, Y-up, subject
 * facing +Z so a three-quarter camera reads the same way as the 2D plates.
 */
function parseObj(text) {
  const positions = [];
  const indices = [];
  for (const line of text.split(/\n/)) {
    if (line.startsWith("v ")) {
      const [, x, y, z] = line.trim().split(/\s+/);
      positions.push(Number(x) / 1000, Number(z) / 1000, -Number(y) / 1000);
    } else if (line.startsWith("f ")) {
      const verts = line
        .trim()
        .slice(2)
        .split(/\s+/)
        .map((tok) => Number(tok.split("/")[0]) - 1);
      for (let i = 1; i < verts.length - 1; i++) {
        indices.push(verts[0], verts[i], verts[i + 1]);
      }
    }
  }
  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
  };
}

function bounds(positions) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = positions[i + k];
      if (v < min[k]) min[k] = v;
      if (v > max[k]) max[k] = v;
    }
  }
  const center = min.map((a, i) => (a + max[i]) / 2);
  const size = min.map((a, i) => max[i] - a);
  return { min, max, center, size };
}

function pca(positions) {
  const { center } = bounds(positions);
  let xx = 0,
    yy = 0,
    zz = 0,
    xy = 0,
    xz = 0,
    yz = 0;
  const n = positions.length / 3;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i] - center[0];
    const y = positions[i + 1] - center[1];
    const z = positions[i + 2] - center[2];
    xx += x * x;
    yy += y * y;
    zz += z * z;
    xy += x * y;
    xz += x * z;
    yz += y * z;
  }
  const cov = [
    [xx / n, xy / n, xz / n],
    [xy / n, yy / n, yz / n],
    [xz / n, yz / n, zz / n],
  ];
  const axes = powerAxes(cov);
  return { center, axes };
}

function powerAxes(cov) {
  const axes = [];
  const mat = cov.map((row) => row.slice());
  for (let a = 0; a < 3; a++) {
    let v = [Math.random(), Math.random(), Math.random()];
    for (let i = 0; i < 24; i++) {
      const w = [
        mat[0][0] * v[0] + mat[0][1] * v[1] + mat[0][2] * v[2],
        mat[1][0] * v[0] + mat[1][1] * v[1] + mat[1][2] * v[2],
        mat[2][0] * v[0] + mat[2][1] * v[1] + mat[2][2] * v[2],
      ];
      const len = Math.hypot(...w) || 1;
      v = w.map((c) => c / len);
    }
    axes.push(v);
    const ev = v[0] * (mat[0][0] * v[0] + mat[0][1] * v[1] + mat[0][2] * v[2]);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) mat[r][c] -= ev * v[r] * v[c];
    }
  }
  return axes;
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
function scale(a, s) {
  return [a[0] * s, a[1] * s, a[2] * s];
}
function norm(a) {
  const l = Math.hypot(...a) || 1;
  return scale(a, 1 / l);
}
function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
function rotateAround(v, axis, deg) {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const k = norm(axis);
  const d = dot(k, v);
  return add(add(scale(v, c), scale(cross(k, v), s)), scale(k, d * (1 - c)));
}

function scatter(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function gridFor(mesh) {
  if (mesh._grid) return mesh._grid;
  const { min, max } = bounds(mesh.positions);
  const ny = 28;
  const nz = 28;
  const cells = Array.from({ length: ny * nz }, () => []);
  const { positions, indices } = mesh;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3;
    const b = indices[i + 1] * 3;
    const c = indices[i + 2] * 3;
    const minY = Math.min(positions[a + 1], positions[b + 1], positions[c + 1]);
    const maxY = Math.max(positions[a + 1], positions[b + 1], positions[c + 1]);
    const minZ = Math.min(positions[a + 2], positions[b + 2], positions[c + 2]);
    const maxZ = Math.max(positions[a + 2], positions[b + 2], positions[c + 2]);
    const y0 = Math.max(0, Math.floor(((minY - min[1]) / (max[1] - min[1] || 1)) * ny));
    const y1 = Math.min(ny - 1, Math.floor(((maxY - min[1]) / (max[1] - min[1] || 1)) * ny));
    const z0 = Math.max(0, Math.floor(((minZ - min[2]) / (max[2] - min[2] || 1)) * nz));
    const z1 = Math.min(nz - 1, Math.floor(((maxZ - min[2]) / (max[2] - min[2] || 1)) * nz));
    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) cells[y * nz + z].push(i);
    }
  }
  mesh._grid = { min, max, ny, nz, cells };
  return mesh._grid;
}

function pointInMesh(p, mesh) {
  const { positions } = mesh;
  const g = gridFor(mesh);
  const oy = p[1];
  const oz = p[2];
  if (oy < g.min[1] || oy > g.max[1] || oz < g.min[2] || oz > g.max[2]) return false;
  const y = Math.min(
    g.ny - 1,
    Math.max(0, Math.floor(((oy - g.min[1]) / (g.max[1] - g.min[1] || 1)) * g.ny)),
  );
  const z = Math.min(
    g.nz - 1,
    Math.max(0, Math.floor(((oz - g.min[2]) / (g.max[2] - g.min[2] || 1)) * g.nz)),
  );
  const cell = g.cells[y * g.nz + z];
  let hits = 0;
  for (const i of cell) {
    const a = mesh.indices[i] * 3;
    const b = mesh.indices[i + 1] * 3;
    const c = mesh.indices[i + 2] * 3;
    if (rayHitTri(p[0], oy, oz, positions, a, b, c)) hits++;
  }
  return hits % 2 === 1;
}

function rayHitTri(ox, oy, oz, pos, a, b, c) {
  const e1x = pos[b] - pos[a];
  const e1y = pos[b + 1] - pos[a + 1];
  const e1z = pos[b + 2] - pos[a + 2];
  const e2x = pos[c] - pos[a];
  const e2y = pos[c + 1] - pos[a + 1];
  const e2z = pos[c + 2] - pos[a + 2];
  const hy = -e2z;
  const hz = e2y;
  const det = e1y * hy + e1z * hz;
  if (Math.abs(det) < 1e-10) return false;
  const inv = 1 / det;
  const sx = ox - pos[a];
  const sy = oy - pos[a + 1];
  const sz = oz - pos[a + 2];
  const u = (sy * hy + sz * hz) * inv;
  if (u < 0 || u > 1) return false;
  const qx = sy * e1z - sz * e1y;
  const qy = sz * e1x - sx * e1z;
  const qz = sx * e1y - sy * e1x;
  const v = qx * inv;
  if (v < 0 || u + v > 1) return false;
  return e2x * qx + e2y * qy + e2z * qz > 1e-8;
}

function directionAt(p, spec, frame) {
  const { long, mid, insert } = frame;
  if (spec.kind === "fan") return norm(sub(insert, p));
  if (spec.kind === "parallel") return long;
  let dir = rotateAround(long, mid, spec.pennation);
  if (spec.kind === "bipennate") {
    const side = Math.sign(dot(sub(p, frame.center), mid) || 1);
    dir = rotateAround(long, mid, spec.pennation * side);
  }
  return norm(dir);
}

function traceOne(seed, spec, mesh, frame) {
  const step = Math.max(frame.length * 0.02, 0.004);
  const limit = frame.length * spec.lfLm;
  const walk = (start, sign) => {
    const pts = [];
    let p = start;
    for (let i = 0; i < 80; i++) {
      if (!pointInMesh(p, mesh)) break;
      pts.push(p);
      const d = directionAt(p, spec, frame);
      p = add(p, scale(d, step * sign));
      if (pts.length >= 2) {
        const len = pathLen(pts);
        if (len > limit) break;
      }
    }
    return pts;
  };
  const fwd = walk(seed, 1);
  const back = walk(seed, -1).reverse();
  const pts = back.concat(fwd.slice(1));
  if (pts.length < 3 || pathLen(pts) < MIN_LEN) return null;
  const sampled = resample(pts, TUBE_PTS);
  const chord = norm(sub(sampled[sampled.length - 1], sampled[0]));
  const angle =
    (Math.acos(Math.min(1, Math.abs(dot(chord, frame.long)))) * 180) / Math.PI;
  if (spec.kind !== "fan" && spec.pennation > 8) {
    if (Math.abs(angle - spec.pennation) > 28) return null;
  }
  return sampled;
}

function pathLen(pts) {
  let n = 0;
  for (let i = 1; i < pts.length; i++) n += Math.hypot(...sub(pts[i], pts[i - 1]));
  return n;
}

function resample(pts, count) {
  const total = pathLen(pts);
  const out = [pts[0]];
  let acc = 0;
  let i = 1;
  for (let s = 1; s < count - 1; s++) {
    const target = (total * s) / (count - 1);
    while (i < pts.length && acc + Math.hypot(...sub(pts[i], pts[i - 1])) < target) {
      acc += Math.hypot(...sub(pts[i], pts[i - 1]));
      i++;
    }
    if (i >= pts.length) {
      out.push(pts[pts.length - 1]);
      continue;
    }
    const seg = Math.hypot(...sub(pts[i], pts[i - 1])) || 1;
    const t = (target - acc) / seg;
    out.push(add(pts[i - 1], scale(sub(pts[i], pts[i - 1]), t)));
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function buildFrame(mesh) {
  const { center, axes } = pca(mesh.positions);
  const long = axes[0];
  const mid = axes[1];
  const { min, max, size } = bounds(mesh.positions);
  const length = Math.max(...size);
  let insertSum = [0, 0, 0];
  let originSum = [0, 0, 0];
  let insertN = 0;
  let originN = 0;
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const p = [mesh.positions[i], mesh.positions[i + 1], mesh.positions[i + 2]];
    const t = dot(sub(p, center), long);
    if (t > length * 0.28) {
      insertSum = add(insertSum, p);
      insertN++;
    } else if (t < -length * 0.28) {
      originSum = add(originSum, p);
      originN++;
    }
  }
  const insert = insertN ? scale(insertSum, 1 / insertN) : add(center, scale(long, length * 0.4));
  const origin = originN ? scale(originSum, 1 / originN) : add(center, scale(long, -length * 0.4));
  return { center, long, mid, insert, origin, length, min, max, size };
}

function seedsFor(mesh, frame, count, salt) {
  const out = [];
  const { min, size } = frame;
  for (let i = 0; i < count * 6 && out.length < count; i++) {
    const p = [
      min[0] + size[0] * scatter(salt + i * 3 + 1),
      min[1] + size[1] * scatter(salt + i * 3 + 2),
      min[2] + size[2] * scatter(salt + i * 3 + 3),
    ];
    if (pointInMesh(p, mesh)) out.push(p);
  }
  return out;
}

function bundleOf(p, frame, split, index) {
  if (split <= 1) return index;
  const t = (dot(sub(p, frame.center), frame.mid) / (frame.size[1] || 1) + 0.5);
  return Math.min(split - 1, Math.max(0, Math.floor(t * split)));
}

function extractObjs(files) {
  mkdirSync(OBJ_DIR, { recursive: true });
  const missing = files.filter((id) => !existsSync(join(OBJ_DIR, `${id}.obj`)));
  if (!missing.length) return;
  const names = missing.map((id) => `isa_BP3D_4.0_obj_99/${id}.obj`);
  const ps = `
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $z = [System.IO.Compression.ZipFile]::OpenRead(${JSON.stringify(ZIP)})
    $out = ${JSON.stringify(OBJ_DIR)}
    $want = @(${names.map((n) => JSON.stringify(n)).join(",")})
    foreach ($e in $z.Entries) {
      if ($want -contains $e.FullName) {
        [System.IO.Compression.ZipFileExtensions]::ExtractToFile($e, (Join-Path $out $e.Name), $true)
      }
    }
    $z.Dispose()
  `;
  execFileSync("powershell", ["-NoProfile", "-Command", ps], { stdio: "inherit" });
}

function writeGlb(meshes, dest) {
  const json = {
    asset: { version: "2.0", generator: "mirin fiber bake" },
    scene: 0,
    scenes: [{ nodes: meshes.map((_, i) => i) }],
    nodes: meshes.map((m, i) => ({ name: m.name, mesh: i })),
    meshes: [],
    accessors: [],
    bufferViews: [],
    buffers: [{ byteLength: 0 }],
  };
  const parts = [];
  let offset = 0;
  const align = (n) => (n + 3) & ~3;
  meshes.forEach((mesh) => {
    const pos = mesh.positions;
    const idx = mesh.indices;
    const posPad = align(pos.byteLength);
    const idxPad = align(idx.byteLength);
    const posBuf = Buffer.alloc(posPad);
    Buffer.from(pos.buffer, pos.byteOffset, pos.byteLength).copy(posBuf);
    const idxBuf = Buffer.alloc(idxPad);
    Buffer.from(idx.buffer, idx.byteOffset, idx.byteLength).copy(idxBuf);
    const b = bounds(pos);
    const posView = json.bufferViews.length;
    json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: pos.byteLength, target: 34962 });
    json.accessors.push({
      bufferView: posView,
      componentType: 5126,
      count: pos.length / 3,
      type: "VEC3",
      min: b.min,
      max: b.max,
    });
    offset += posPad;
    const idxView = json.bufferViews.length;
    json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: idx.byteLength, target: 34963 });
    json.accessors.push({
      bufferView: idxView,
      componentType: 5125,
      count: idx.length,
      type: "SCALAR",
    });
    offset += idxPad;
    json.meshes.push({
      primitives: [
        {
          attributes: { POSITION: json.accessors.length - 2 },
          indices: json.accessors.length - 1,
          mode: 4,
        },
      ],
    });
    parts.push(posBuf, idxBuf);
  });
  json.buffers[0].byteLength = offset;
  const jsonBuf = Buffer.from(JSON.stringify(json));
  const jsonPad = align(jsonBuf.length);
  const jsonChunk = Buffer.alloc(jsonPad, 0x20);
  jsonBuf.copy(jsonChunk);
  const binChunk = Buffer.concat(parts);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  const total = 12 + 8 + jsonChunk.length + 8 + binChunk.length;
  header.writeUInt32LE(total, 8);
  const jsonHead = Buffer.alloc(8);
  jsonHead.writeUInt32LE(jsonChunk.length, 0);
  jsonHead.writeUInt32LE(0x4e4f534a, 4);
  const binHead = Buffer.alloc(8);
  binHead.writeUInt32LE(binChunk.length, 0);
  binHead.writeUInt32LE(0x004e4942, 4);
  writeFileSync(dest, Buffer.concat([header, jsonHead, jsonChunk, binHead, binChunk]));
}

const REGIONS = {
  "front-delt": {
    belly: ["clavicular part of left deltoid"],
    neighbors: ["acromial part of left deltoid", "clavicular part of left pectoralis major"],
    bundles: [{ name: "clavicular part of left deltoid", pennation: 0, lfLm: 0.45, kind: "fan", split: 3 }],
  },
  "side-delt": {
    belly: ["acromial part of left deltoid"],
    neighbors: ["clavicular part of left deltoid", "spinal part of left deltoid"],
    bundles: [{ name: "acromial part of left deltoid", pennation: 20, lfLm: 0.42, kind: "bipennate", split: 3 }],
  },
  "rear-delt": {
    belly: ["spinal part of left deltoid"],
    neighbors: ["acromial part of left deltoid", "transverse part of left trapezius"],
    bundles: [{ name: "spinal part of left deltoid", pennation: 18, lfLm: 0.5, kind: "pennate", split: 3 }],
  },
  chest: {
    belly: [
      "clavicular part of left pectoralis major",
      "sternocostal part of left pectoralis major",
      "abdominal part of left pectoralis major",
    ],
    neighbors: ["clavicular part of left deltoid"],
    bundles: [
      { name: "clavicular part of left pectoralis major", pennation: 0, lfLm: 0.42, kind: "fan" },
      { name: "sternocostal part of left pectoralis major", pennation: 0, lfLm: 0.46, kind: "fan" },
      { name: "abdominal part of left pectoralis major", pennation: 0, lfLm: 0.44, kind: "fan" },
    ],
  },
  lats: {
    belly: ["left teres major"],
    neighbors: ["left serratus anterior", "spinal part of left deltoid"],
    bundles: [{ name: "left teres major", pennation: 0, lfLm: 0.86, kind: "fan", split: 3 }],
    note: "BodyParts3D 4.0 has no named latissimus element; teres major is the neighbouring adducting mesh.",
  },
  traps: {
    belly: [
      "descending part of left trapezius",
      "transverse part of left trapezius",
      "ascending part of left trapezius",
    ],
    neighbors: ["spinal part of left deltoid"],
    bundles: [
      { name: "descending part of left trapezius", pennation: 0, lfLm: 0.9, kind: "fan" },
      { name: "transverse part of left trapezius", pennation: 0, lfLm: 0.9, kind: "parallel" },
      { name: "ascending part of left trapezius", pennation: 0, lfLm: 0.9, kind: "fan" },
    ],
  },
  glutes: {
    belly: ["left gluteus maximus"],
    neighbors: ["left gluteus medius"],
    bundles: [{ name: "left gluteus maximus", pennation: 0, lfLm: 0.62, kind: "fan", split: 3 }],
  },
  triceps: {
    belly: [
      "lateral head of left triceps brachii",
      "long head of left triceps brachii",
      "medial head of left triceps brachii",
    ],
    neighbors: ["long head of left biceps brachii"],
    bundles: [
      { name: "lateral head of left triceps brachii", pennation: 15, lfLm: 0.25, kind: "pennate" },
      { name: "long head of left triceps brachii", pennation: 12, lfLm: 0.3, kind: "pennate" },
      { name: "medial head of left triceps brachii", pennation: 20, lfLm: 0.3, kind: "pennate" },
    ],
  },
  quads: {
    belly: ["left vastus lateralis", "left rectus femoris", "left vastus medialis"],
    neighbors: ["left vastus intermedius"],
    bundles: [
      { name: "left vastus lateralis", pennation: 18.4, lfLm: 0.38, kind: "pennate" },
      { name: "left rectus femoris", pennation: 13.9, lfLm: 0.21, kind: "bipennate" },
      { name: "left vastus medialis", pennation: 29.6, lfLm: 0.22, kind: "pennate" },
    ],
  },
  calves: {
    belly: [
      "medial head of left gastrocnemius",
      "lateral head of left gastrocnemius",
      "left soleus",
    ],
    neighbors: [],
    bundles: [
      { name: "medial head of left gastrocnemius", pennation: 9.9, lfLm: 0.19, kind: "bipennate" },
      { name: "lateral head of left gastrocnemius", pennation: 12, lfLm: 0.27, kind: "bipennate" },
      { name: "left soleus", pennation: 28.3, lfLm: 0.11, kind: "bipennate" },
    ],
  },
  biceps: {
    belly: ["long head of left biceps brachii", "short head of left biceps brachii"],
    neighbors: ["lateral head of left triceps brachii"],
    bundles: [
      { name: "long head of left biceps brachii", pennation: 0, lfLm: 0.62, kind: "parallel" },
      { name: "short head of left biceps brachii", pennation: 0, lfLm: 0.62, kind: "parallel" },
    ],
  },
  hamstrings: {
    belly: ["long head of left biceps femoris", "left semitendinosus", "left semimembranosus"],
    neighbors: ["left gluteus maximus"],
    bundles: [
      { name: "long head of left biceps femoris", pennation: 11.6, lfLm: 0.28, kind: "pennate" },
      { name: "left semitendinosus", pennation: 12.9, lfLm: 0.65, kind: "pennate" },
      { name: "left semimembranosus", pennation: 15.1, lfLm: 0.24, kind: "pennate" },
    ],
  },
  forearms: {
    belly: ["left brachioradialis", "left flexor carpi radialis"],
    neighbors: ["long head of left biceps brachii"],
    bundles: [
      { name: "left brachioradialis", pennation: 2, lfLm: 0.55, kind: "parallel" },
      { name: "left flexor carpi radialis", pennation: 6, lfLm: 0.32, kind: "pennate" },
    ],
  },
  abs: {
    belly: ["left external oblique"],
    neighbors: ["abdominal part of left pectoralis major"],
    bundles: [{ name: "left external oblique", pennation: 0, lfLm: 0.95, kind: "parallel", split: 3 }],
    note: "BodyParts3D 4.0 has no named rectus abdominis element; the left external oblique is the abdominal-wall mesh.",
  },
  "lower-back": {
    belly: ["left iliocostalis lumborum", "left longissimus thoracis", "left spinalis thoracis"],
    neighbors: ["left iliocostalis thoracis"],
    bundles: [
      { name: "left iliocostalis lumborum", pennation: 0, lfLm: 0.9, kind: "parallel" },
      { name: "left longissimus thoracis", pennation: 0, lfLm: 0.9, kind: "parallel" },
      { name: "left spinalis thoracis", pennation: 0, lfLm: 0.9, kind: "parallel" },
    ],
  },
};

function loadMesh(id) {
  const path = join(OBJ_DIR, `${id}.obj`);
  if (!existsSync(path)) throw new Error(`missing ${id}.obj`);
  return parseObj(readFileSync(path, "utf8"));
}

function bakeRegion(id, spec, byName) {
  const resolve = (name) => {
    const file = pickFile(byName, name);
    if (!file) throw new Error(`no BodyParts3D file for "${name}"`);
    return file;
  };
  const bellyFiles = spec.belly.map(resolve);
  const neighborFiles = spec.neighbors.map(resolve).filter((f) => !bellyFiles.includes(f));
  extractObjs([...new Set([...bellyFiles, ...neighborFiles])]);

  const bellyMeshes = bellyFiles.map((f, i) => ({
    name: i === 0 ? "belly" : `belly_${i}`,
    ...loadMesh(f),
  }));
  const neighborMeshes = neighborFiles.map((f, i) => ({
    name: `near_${i}`,
    ...loadMesh(f),
  }));

  const fascicles = [];
  spec.bundles.forEach((bundle, bundleIndex) => {
    const file = resolve(bundle.name);
    const mesh = loadMesh(file);
    const frame = buildFrame(mesh);
    const seeds = seedsFor(mesh, frame, SEEDS, bundleIndex * 97 + 11);
    for (const seed of seeds) {
      const path = traceOne(seed, bundle, mesh, frame);
      if (!path) continue;
      const mid = path[Math.floor(path.length / 2)];
      const b =
        bundle.split && bundle.split > 1
          ? bundleOf(mid, frame, bundle.split, bundleIndex)
          : bundleIndex;
      fascicles.push({ b, p: path.flatMap((pt) => pt.map((n) => Math.round(n * 10000) / 10000)) });
    }
  });

  if (fascicles.length < 24) {
    throw new Error(`${id}: only ${fascicles.length} fascicles survived`);
  }

  mkdirSync(OUT, { recursive: true });
  writeGlb([...bellyMeshes, ...neighborMeshes], join(OUT, `${id}.glb`));
  writeFileSync(
    join(OUT, `${id}.json`),
    JSON.stringify({
      region: id,
      note: spec.note ?? undefined,
      fascicles,
    }),
  );
  return fascicles.length;
}

function main() {
  if (!existsSync(ZIP) || !existsSync(MAP)) {
    throw new Error("BodyParts3D archive or element map missing under .tmp-assets/bp3d");
  }
  const byName = loadFileMap();
  const report = [];
  for (const [id, spec] of Object.entries(REGIONS)) {
    try {
      const n = bakeRegion(id, spec, byName);
      report.push(`${id}\t${n}`);
      console.log(`baked ${id} (${n} fascicles)`);
    } catch (err) {
      report.push(`${id}\tFAIL\t${err instanceof Error ? err.message : err}`);
      console.error(`failed ${id}:`, err);
    }
  }
  writeFileSync(join(OUT, "bake-log.txt"), report.join("\n") + "\n");
}

main();
