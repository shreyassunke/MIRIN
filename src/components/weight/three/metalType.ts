import * as THREE from "three";
import { bakeSceneToCanvas, getEnvironment } from "./stage";

let neutral: Uint8ClampedArray | null = null;
let strip: string | null = null;
const tinted = new Map<string, string>();

/**
 * A smooth rod under one overhead key, the same direction as the bar's key.
 * The plate fill is left off: it exists to rake disc faces and it washes a
 * front-facing surface to a flat sticker.
 */
function bakeNeutral(): Uint8ClampedArray | null {
  if (neutral) return neutral;
  if (typeof document === "undefined") return null;
  const dest = document.createElement("canvas");
  dest.width = 8;
  dest.height = 256;
  const scene = new THREE.Scene();
  const geo = new THREE.CylinderGeometry(1, 1, 0.4, 128, 1, false);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.94,
    roughness: 0.2,
    envMapIntensity: 0.4,
  });
  try {
    const key = new THREE.DirectionalLight(0xf7f7f7, 2.6);
    key.position.set(0, 3.4, 1.6);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xb8b8be, 0.22);
    fill.position.set(0, -0.4, 2.6);
    scene.add(fill);
    scene.environment = getEnvironment();
    scene.environmentIntensity = 0.32;
    geo.rotateZ(Math.PI / 2);
    scene.add(new THREE.Mesh(geo, mat));
    const camera = new THREE.OrthographicCamera(-0.12, 0.12, 1.02, -1.02, 0.1, 12);
    camera.position.set(0, 0, 4);
    camera.lookAt(0, 0, 0);
    bakeSceneToCanvas(scene, camera, dest, { exposure: 0.85 });
    const ctx = dest.getContext("2d");
    if (!ctx) return null;
    const img = ctx.getImageData(0, 0, dest.width, dest.height);
    const column = new Array<number>(dest.height);
    const x = Math.floor(dest.width / 2);
    for (let y = 0; y < dest.height; y++) {
      const i = (y * dest.width + x) * 4;
      column[y] = Math.max(img.data[i], img.data[i + 1], img.data[i + 2]);
    }
    const shaped = shapeRod(column);
    for (let y = 0; y < dest.height; y++) {
      const shade = shaped[y];
      for (let px = 0; px < dest.width; px++) {
        const i = (y * dest.width + px) * 4;
        img.data[i] = shade;
        img.data[i + 1] = shade;
        img.data[i + 2] = shade;
        img.data[i + 3] = 255;
      }
    }
    neutral = img.data;
    ctx.putImageData(img, 0, 0);
    strip = dest.toDataURL("image/png");
    return neutral;
  } catch {
    return null;
  } finally {
    geo.dispose();
    mat.dispose();
  }
}

/**
 * One falloff, crown to foot. A full cylinder is bright in the middle and
 * dark at both rims, which paints a second band through the digit. Keep the
 * lit face from the highlight downward and lay that across the stroke.
 */
function shapeRod(column: number[]): number[] {
  const radius = 28;
  const smooth = column.map((_, i) => {
    let acc = 0;
    let weight = 0;
    for (let k = -radius; k <= radius; k++) {
      const j = Math.min(column.length - 1, Math.max(0, i + k));
      const w = radius + 1 - Math.abs(k);
      acc += column[j] * w;
      weight += w;
    }
    return acc / weight;
  });
  let peak = 0;
  for (let i = 1; i < smooth.length; i++) {
    if (smooth[i] > smooth[peak]) peak = i;
  }
  let face = smooth.slice(peak);
  if (face.length < smooth.length * 0.35) face = smooth.slice(0, peak + 1).reverse();
  const mono = [face[0]];
  for (let i = 1; i < face.length; i++) mono.push(Math.min(mono[i - 1], face[i]));
  const foot = 178;
  const crown = 252;
  const low = mono[mono.length - 1];
  const high = mono[0];
  const span = Math.max(1, high - low);
  return smooth.map((_, i) => {
    const f = (i / (smooth.length - 1)) * (mono.length - 1);
    const j = Math.floor(f);
    const k = Math.min(mono.length - 1, j + 1);
    const value = mono[j] + (mono[k] - mono[j]) * (f - j);
    const t = (value - low) / span;
    return Math.round(foot + t * (crown - foot));
  });
}

function parseColor(color: string): [number, number, number] | null {
  const hex = color.trim().match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = Number.parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = color.match(/(\d+)\D+(\d+)\D+(\d+)/);
  if (!rgb) return null;
  return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
}

/** Resting steel. Prefer {@link tintedMetalUrl} so light mode stays ink. */
export function metalStripUrl(): string | null {
  bakeNeutral();
  return strip;
}

/** The same rod, multiplied by a pigment, so the color is the metal. */
export function tintedMetalUrl(color: string): string | null {
  const hit = tinted.get(color);
  if (hit) return hit;
  const src = bakeNeutral();
  const pigment = parseColor(color);
  if (!src || !pigment) return null;
  const dest = document.createElement("canvas");
  dest.width = 8;
  dest.height = 256;
  const ctx = dest.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(dest.width, dest.height);
  const [r, g, b] = pigment;
  for (let i = 0; i < src.length; i += 4) {
    const lum = src[i] / 255;
    img.data[i] = Math.round(r * lum);
    img.data[i + 1] = Math.round(g * lum);
    img.data[i + 2] = Math.round(b * lum);
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const url = dest.toDataURL("image/png");
  if (tinted.size > 96) tinted.clear();
  tinted.set(color, url);
  return url;
}
