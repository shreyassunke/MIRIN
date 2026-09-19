import * as THREE from "three";
import { formatWeight } from "../../../lib/workout";

const texCache = new Map<string, THREE.CanvasTexture>();
const matCache = new Map<string, THREE.SpriteMaterial>();

function fontsReady() {
  return typeof document !== "undefined" && document.fonts?.status === "loaded";
}

/** Raised Inter numeral with a dark iron bite — readable at instrument scale. */
function canvasTexture(label: string): THREE.CanvasTexture {
  const cacheable = fontsReady();
  const key = cacheable ? label : `${label}:pending`;
  const hit = texCache.get(key);
  if (hit) return hit;

  const w = 512;
  const h = 280;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const empty = new THREE.CanvasTexture(canvas);
    texCache.set(key, empty);
    return empty;
  }

  ctx.clearRect(0, 0, w, h);

  const size = label.length >= 4 ? 148 : label.length === 3 ? 176 : 208;
  ctx.font = `600 ${size}px "Inter Variable", Inter, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.lineWidth = 26;
  ctx.strokeStyle = "rgba(10, 10, 10, 0.9)";
  ctx.strokeText(label, w / 2, h / 2 + 2);
  ctx.fillStyle = "#fafafa";
  ctx.fillText(label, w / 2, h / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  texCache.set(key, tex);
  return tex;
}

function stampMaterial(label: string): THREE.SpriteMaterial {
  const cacheable = fontsReady();
  const key = cacheable ? label : `${label}:pending`;
  const hit = matCache.get(key);
  if (hit) return hit;
  const mat = new THREE.SpriteMaterial({
    map: canvasTexture(label),
    transparent: true,
    depthTest: false,
    depthWrite: false,
    sizeAttenuation: true,
  });
  matCache.set(key, mat);
  return mat;
}

/**
 * Denomination on the camera-facing rim at 12 and 6 o'clock.
 * Sprites stay screen-upright so the ledger figures read like stamped iron.
 */
export function addRimStamps(
  parent: THREE.Object3D,
  value: number,
  radius: number,
  _thickness: number,
) {
  const label = formatWeight(value);
  const mat = stampMaterial(label);
  const width = radius * (label.length >= 4 ? 1.08 : label.length === 3 ? 0.96 : 0.9);
  const height = width * 0.46;
  const y = radius * 0.5;
  const z = radius * 0.08;

  const top = new THREE.Sprite(mat);
  top.scale.set(width, height, 1);
  top.position.set(0, y, z);
  top.name = "stampTop";
  top.renderOrder = 2;
  top.raycast = () => {};

  const bottom = new THREE.Sprite(mat);
  bottom.scale.set(width, height, 1);
  bottom.position.set(0, -y, z);
  bottom.name = "stampBottom";
  bottom.renderOrder = 2;
  bottom.raycast = () => {};

  parent.add(top, bottom);
}
