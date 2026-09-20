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
  const key = `pl:${label}:${hex}:${ready ? "f" : "p"}`;
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
    // A painted ring reads as a face marking even when the number itself is
    // foreshortened to a sliver, which is what happens at this pose.
    ctx.strokeStyle = ink;
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = s * 0.01;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.47, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
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
  hole: number,
  faceX: number,
) {
  const map = plateFaceTexture(value, hex);
  // Clear the steel hub so the decal never fights it for the same pixels.
  const inner = Math.max(hole * 1.85, radius * 0.3);
  const geo = new THREE.RingGeometry(inner, radius * 0.78, 64);
  geo.userData.shared = false;
  for (const side of [1, -1] as const) {
    const mat = new THREE.MeshBasicMaterial({
      map,
      color: 0xffffff,
      transparent: true,
      alphaTest: 0.12,
      depthWrite: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      opacity: 0.82,
    });
    const mesh = new THREE.Mesh(geo, mat);
    orientAxialDisc(mesh, side);
    mesh.position.x = side * faceX;
    mesh.name = side === 1 ? "plateFaceOut" : "plateFaceIn";
    mesh.raycast = () => {};
    parent.add(mesh);
  }
}
