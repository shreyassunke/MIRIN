import * as THREE from "three";
import { plateInk } from "../../../lib/units";
import { formatWeight } from "../../../lib/workout";

const texCache = new Map<string, THREE.CanvasTexture>();

function fontsReady() {
  return typeof document !== "undefined" && document.fonts?.status === "loaded";
}

function paintWeight(
  ctx: CanvasRenderingContext2D,
  label: string,
  cx: number,
  cy: number,
  size: number,
  fill: string,
) {
  ctx.font = `700 ${size}px "Inter Variable", Inter, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = fill;
  ctx.fillText(label, cx, cy);
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

export function plateFaceTexture(value: number, hex: string): THREE.CanvasTexture {
  const label = formatWeight(value);
  const ready = fontsReady();
  const key = `pl2:${label}:${hex}:${ready ? "f" : "p"}`;
  const hit = texCache.get(key);
  if (hit) return hit;

  const s = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, s, s);
    const ink = plateInk(hex);
    const size = label.length >= 4 ? s * 0.15 : s * 0.2;
    paintWeight(ctx, label, s / 2, s * 0.24, size, ink);
    paintWeight(ctx, label, s / 2, s * 0.76, size, ink);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.center.set(0.5, 0.5);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  texCache.set(key, tex);
  return tex;
}

export function addPlateFaces(
  parent: THREE.Object3D,
  value: number,
  hex: string,
  radius: number,
  insert: number,
  faceX: number,
) {
  const map = plateFaceTexture(value, hex);
  const inner = Math.max(insert * 1.12, radius * 0.28);
  const geo = new THREE.RingGeometry(inner, radius * 0.78, 64);
  geo.userData.shared = false;
  // Inboard face only. The left stack is the right stack under scale.x = -1,
  // so local -X is toward the collar on both sides — the face the camera sees.
  const mat = new THREE.MeshBasicMaterial({
    map,
    color: 0xffffff,
    transparent: false,
    alphaTest: 0.08,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
    toneMapped: false,
    side: THREE.FrontSide,
  });
  mat.name = "plateStamp";
  const mesh = new THREE.Mesh(geo, mat);
  orientAxialDisc(mesh, -1);
  mesh.position.x = -faceX;
  mesh.name = "plateFaceIn";
  mesh.raycast = () => {};
  parent.add(mesh);
}
