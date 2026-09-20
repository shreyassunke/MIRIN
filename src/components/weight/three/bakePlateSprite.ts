import * as THREE from "three";
import { plateColor, plateInk, type Unit } from "../../../lib/units";
import { formatWeight } from "../../../lib/workout";
import { createPlate, disposeUnsharedPlate } from "./createPlate";
import { PLATE_HOLE_R } from "./scale";
import { bakeSceneToCanvas, getEnvironment } from "./stage";

const cache = new Map<string, HTMLCanvasElement>();
const CHIP_PAD = 1.08;

function fontTag() {
  return typeof document !== "undefined" && document.fonts?.status === "loaded"
    ? "f"
    : "p";
}

/** Frontal key so the Plate Exception swatches survive the bake. */
function createChipScene() {
  const scene = new THREE.Scene();
  scene.background = null;
  scene.environment = getEnvironment();
  scene.environmentIntensity = 0.95;

  const key = new THREE.DirectionalLight(0xffffff, 1.7);
  key.position.set(0.12, 0.35, 2.6);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xf2f2f2, 0.7);
  fill.position.set(-1.3, 0.7, 1.4);
  scene.add(fill);

  scene.add(new THREE.HemisphereLight(0xe8e8e8, 0x2a2a2a, 0.42));
  scene.add(new THREE.AmbientLight(0xffffff, 0.48));
  return scene;
}

function fitChipCamera(camera: THREE.OrthographicCamera, radius: number) {
  const half = radius * CHIP_PAD;
  camera.left = -half;
  camera.right = half;
  camera.top = half;
  camera.bottom = -half;
  camera.near = 1;
  camera.far = radius + 200;
  camera.position.set(0, 0, radius + 80);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}

function paintChipOverlay(
  dest: HTMLCanvasElement,
  value: number,
  hex: string,
  radius: number,
) {
  const ctx = dest.getContext("2d");
  if (!ctx) return;
  const s = dest.width;
  const cx = s / 2;
  const cy = s / 2;
  const rPx = s / (2 * CHIP_PAD);
  const hub = Math.max(s * 0.08, rPx * (PLATE_HOLE_R / radius));
  ctx.fillStyle = "#1c1c1c";
  ctx.beginPath();
  ctx.arc(cx, cy, hub, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#98989f";
  ctx.lineWidth = Math.max(1.25, s * 0.02);
  ctx.stroke();

  const label = formatWeight(value);
  const yOff = Math.max(rPx * 0.4, hub + s * 0.12);
  ctx.fillStyle = plateInk(hex);
  ctx.font = `700 ${Math.round(s * (label.length >= 4 ? 0.17 : 0.22))}px "Inter Variable", Inter, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, cx, cy - yOff);
  ctx.fillText(label, cx, cy + yOff);
}

/** Face-on bumper, same mesh the bar loads. */
export function bakePlateSprite(
  value: number,
  unit: Unit,
  cssPx: number,
): HTMLCanvasElement {
  const dpr = Math.min(2, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
  const px = Math.max(48, Math.round(cssPx * dpr));
  const hex = plateColor(unit, value);
  const key = `${unit}:${value}:${px}:${fontTag()}:${hex}:face5`;
  const hit = cache.get(key);
  if (hit) return hit;

  const dest = document.createElement("canvas");
  dest.width = px;
  dest.height = px;

  const plate = createPlate(value, unit, { stamp: false });
  plate.traverse((child) => {
    if (child.name === "plateFaceOut" || child.name === "plateFaceIn") {
      child.visible = false;
    }
    if (!(child instanceof THREE.Mesh)) return;
    const mat = child.material;
    if (!(mat instanceof THREE.MeshStandardMaterial)) return;
    const clone = mat.clone();
    clone.name = "";
    clone.side = THREE.DoubleSide;
    clone.roughness = Math.min(clone.roughness, 0.52);
    clone.envMapIntensity = Math.max(clone.envMapIntensity, 0.6);
    child.material = clone;
  });
  plate.rotation.order = "YXZ";
  // Thickness is +X; −Y yaw puts the wound −X face on camera.
  plate.rotation.set(0, -Math.PI / 2, 0);
  const radius = plate.userData.radius as number;

  const scene = createChipScene();
  scene.add(plate);
  const camera = new THREE.OrthographicCamera();
  fitChipCamera(camera, radius);
  bakeSceneToCanvas(scene, camera, dest, {
    toneMapping: THREE.NoToneMapping,
    exposure: 1,
  });
  paintChipOverlay(dest, value, hex, radius);

  disposeUnsharedPlate(plate);
  cache.set(key, dest);
  return dest;
}
