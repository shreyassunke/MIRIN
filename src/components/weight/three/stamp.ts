import * as THREE from "three";
import { paintPlateChipFace, plateChipHub } from "../paintPlateChip";

const texCache = new Map<string, THREE.CanvasTexture>();

function fontsReady() {
  return typeof document !== "undefined" && document.fonts?.status === "loaded";
}

/**
 * Disc in XY (canvas up = +Y), turned so its normal points out along the
 * plate's own axis. Getting the sign wrong faces the decal into the plate,
 * where backface culling eats it — invisible edge-on, obvious head-on.
 */
function orientAxialDisc(mesh: THREE.Mesh, side: 1 | -1) {
  mesh.rotation.order = "YXZ";
  mesh.rotation.set(0, (side * Math.PI) / 2, 0);
}

export type PlateFaceDims = {
  radius: number;
  hole: number;
  insert: number;
};

/** Same drawing as the plate chips, mapped onto a disc. */
export function plateFaceTexture(
  value: number,
  hex: string,
  dims: PlateFaceDims,
): THREE.CanvasTexture {
  const ready = fontsReady();
  const key = `face5:${value}:${hex}:${dims.hole.toFixed(3)}:${dims.insert.toFixed(3)}:${ready ? "f" : "p"}`;
  const hit = texCache.get(key);
  if (hit) return hit;

  const s = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, s, s);
    const cx = s / 2;
    const cy = s / 2;
    const r = s / 2;
    const { hub, bore } = plateChipHub(r, dims);
    paintPlateChipFace(ctx, value, hex, cx, cy, r, hub, {
      wash: true,
      bore,
      baseFill: hex,
      // Chip-sized along the hub–rim band; stretched on the axis the
      // 0.23 face ellipse compresses so they stay readable, not giant.
      numeralYScale: 2.8,
    });
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.center.set(0.5, 0.5);
  // 3/9 on the chip become 12/6 in the bar pose, so the numerals sit on
  // the face ellipse's major axis instead of collapsing into the rim.
  tex.rotation = Math.PI / 2;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  texCache.set(key, tex);
  return tex;
}

export type PlateStampFaces = {
  inboard?: boolean;
  outboard?: boolean;
  /** Parent lives under scale.x = -1; flip the decal so the label still reads. */
  unmirror?: boolean;
};

export function addPlateFaces(
  parent: THREE.Object3D,
  value: number,
  hex: string,
  dims: PlateFaceDims,
  faceX: number,
  faces: PlateStampFaces = { inboard: true },
) {
  const map = plateFaceTexture(value, hex, dims);
  const geo = new THREE.CircleGeometry(dims.radius * 0.998, 64);
  geo.userData.shared = false;

  const add = (side: 1 | -1, name: string) => {
    const mat = new THREE.MeshBasicMaterial({
      map,
      color: 0xffffff,
      transparent: false,
      depthWrite: true,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    mat.name = "plateStamp";
    const mesh = new THREE.Mesh(geo, mat);
    orientAxialDisc(mesh, side);
    mesh.position.x = side * (faceX + 0.02);
    if (faces.unmirror) mesh.scale.x = -1;
    mesh.name = name;
    mesh.raycast = () => {};
    parent.add(mesh);
  };

  if (faces.inboard) add(-1, "plateFaceIn");
  if (faces.outboard) add(1, "plateFaceOut");
}

function dumbbellFaceTexture(value: number): THREE.CanvasTexture {
  const ready = fontsReady();
  const key = `dbn3:${value}:${ready ? "f" : "p"}`;
  const hit = texCache.get(key);
  if (hit) return hit;

  const s = 512;
  const canvas = document.createElement("canvas");
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, s, s);
    ctx.fillStyle = "#f2f2f2";
    ctx.font = "600 200px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(parseFloat(value.toFixed(2))), s / 2, s / 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.center.set(0.5, 0.5);
  tex.rotation = Math.PI / 2;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  texCache.set(key, tex);
  return tex;
}

/** Outer-face weight numeral on a urethane dumbbell head. */
export function clearDumbbellFace(head: THREE.Object3D) {
  const prev = head.getObjectByName("dbStamp");
  if (!(prev instanceof THREE.Mesh)) return;
  head.remove(prev);
  prev.geometry.dispose();
  const mat = prev.material;
  if (mat && !Array.isArray(mat)) {
    mat.map = null;
    mat.dispose();
  }
}

export function replaceDumbbellFace(
  head: THREE.Object3D,
  side: 1 | -1,
  value: number,
  radius: number,
  thickness: number,
) {
  clearDumbbellFace(head);

  const map = dumbbellFaceTexture(value);
  const geo = new THREE.CircleGeometry(radius * 0.5, 48);
  geo.userData.shared = false;
  const mat = new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  mat.name = "dbStamp";
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "dbStamp";
  mesh.raycast = () => {};
  orientAxialDisc(mesh, side);
  mesh.position.x = side * (thickness / 2 + 0.03);
  head.add(mesh);
}
