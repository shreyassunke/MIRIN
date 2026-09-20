import * as THREE from "three";
import { plateColor, type Unit } from "../../../lib/units";
import { paintPlateChipFace, plateChipHub } from "../paintPlateChip";
import { createPlate, disposeUnsharedPlate } from "./createPlate";
import { plateWorldDims } from "./scale";
import { bakeSceneToCanvas, getEnvironment } from "./stage";

const cache = new Map<string, HTMLCanvasElement>();
const CHIP_PAD = 1.12;

function fontTag() {
  return typeof document !== "undefined" && document.fonts?.status === "loaded"
    ? "f"
    : "p";
}

/** Grazing key so the urethane rim and hub flange read as volume. */
function createChipScene() {
  const scene = new THREE.Scene();
  scene.background = null;
  scene.environment = getEnvironment();
  scene.environmentIntensity = 1.05;

  const key = new THREE.DirectionalLight(0xffffff, 2.15);
  key.position.set(0.55, 0.95, 1.8);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xf2f2f2, 0.38);
  fill.position.set(-1.6, 0.2, 1.1);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 0.55);
  rim.position.set(-0.4, -0.2, -1.6);
  scene.add(rim);

  scene.add(new THREE.HemisphereLight(0xdedede, 0x1a1a1a, 0.22));
  scene.add(new THREE.AmbientLight(0xffffff, 0.16));
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
  unit: Unit,
  hex: string,
) {
  const ctx = dest.getContext("2d");
  if (!ctx) return;
  const s = dest.width;
  const cx = s / 2;
  const cy = s / 2;
  const rPx = s / (2 * CHIP_PAD);
  const dims = plateWorldDims(value, unit);
  const { hub, bore } = plateChipHub(rPx, dims);
  const hubPx = Math.max(s * 0.07, hub);
  paintPlateChipFace(ctx, value, hex, cx, cy, rPx, hubPx, {
    wash: true,
    bore: hubPx * (bore / hub),
  });
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
  const key = `${unit}:${value}:${px}:${fontTag()}:${hex}:face15`;
  const hit = cache.get(key);
  if (hit) return hit;

  const dest = document.createElement("canvas");
  dest.width = px;
  dest.height = px;

  const plate = createPlate(value, unit);
  plate.traverse((child) => {
    if (
      child.name === "plateFaceOut" ||
      child.name === "plateFaceIn" ||
      child.name.startsWith("lip") ||
      child.name.startsWith("hubFlange") ||
      child.name.startsWith("hubBead")
    ) {
      child.visible = false;
    }
    if (!(child instanceof THREE.Mesh)) return;
    const mat = child.material;
    if (!(mat instanceof THREE.MeshStandardMaterial)) return;
    const clone = mat.clone();
    clone.name = "";
    clone.side = THREE.DoubleSide;
    clone.roughness = Math.min(clone.roughness, 0.48);
    clone.envMapIntensity = Math.max(clone.envMapIntensity, 0.75);
    child.material = clone;
  });
  plate.rotation.order = "YXZ";
  // Thickness is +X; −Y yaw puts the face on camera. A few degrees of
  // pitch lets the outer lip catch the key without reading as an oval.
  plate.rotation.set(0.07, -Math.PI / 2, 0);
  const radius = plate.userData.radius as number;

  const scene = createChipScene();
  scene.add(plate);
  const camera = new THREE.OrthographicCamera();
  fitChipCamera(camera, radius);
  bakeSceneToCanvas(scene, camera, dest, {
    toneMapping: THREE.NoToneMapping,
    exposure: 1,
  });
  paintChipOverlay(dest, value, unit, hex);

  disposeUnsharedPlate(plate);
  cache.set(key, dest);
  return dest;
}
