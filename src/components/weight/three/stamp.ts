import * as THREE from "three";
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
 * Disc in XY (canvas up = +Y). Rotate onto ±X with no roll so numerals
 * stay world-up when the bar is viewed from a small yaw.
 */
function orientAxialDisc(mesh: THREE.Mesh, side: 1 | -1) {
  mesh.rotation.order = "YXZ";
  mesh.rotation.set(0, side === 1 ? -Math.PI / 2 : Math.PI / 2, 0);
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
    const size = label.length >= 4 ? s * 0.15 : s * 0.2;
    paintWeight(ctx, label, s / 2, s * 0.22, size, "#fafafa");
    paintWeight(ctx, label, s / 2, s * 0.78, size, "#fafafa");
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
  faceX: number,
) {
  const map = plateFaceTexture(value, hex);
  const geo = new THREE.RingGeometry(radius * 0.28, radius * 0.74, 64);
  geo.userData.shared = false;
  for (const side of [1, -1] as const) {
    const mat = new THREE.MeshStandardMaterial({
      map,
      color: 0xffffff,
      metalness: 0.1,
      roughness: 0.7,
      transparent: true,
      alphaTest: 0.12,
      depthWrite: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      envMapIntensity: 0.2,
    });
    const mesh = new THREE.Mesh(geo, mat);
    orientAxialDisc(mesh, side);
    mesh.position.x = side * faceX;
    mesh.name = side === 1 ? "plateFaceOut" : "plateFaceIn";
    mesh.raycast = () => {};
    parent.add(mesh);
  }
}
