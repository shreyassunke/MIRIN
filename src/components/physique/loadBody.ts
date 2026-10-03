import * as THREE from "three";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { Gender } from "../../lib/body";
import { regionFromAnatomy, type RegionId } from "../../lib/muscleRegions";

const MALE_URL = "/models/body.glb";
const FEMALE_URL = "/models/body-female.glb";
const DRACO_PATH = "/draco/";
const FIT = 1.72;

const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _center = new THREE.Vector3();
const _world = new THREE.Vector3();
const _tint = new THREE.Color();

export interface PhysiqueEnvelope {
  halfH: number;
  halfR: number;
  cx: number;
  cy: number;
  cz: number;
}

function isWorldVisible(obj: THREE.Object3D) {
  let current: THREE.Object3D | null = obj;
  while (current) {
    if (!current.visible) return false;
    current = current.parent;
  }
  return true;
}

/** AABB of visible meshes only — hidden bones must not set the crop. */
export function visibleEnvelope(root: THREE.Object3D): PhysiqueEnvelope {
  root.updateWorldMatrix(true, true);
  _box.makeEmpty();
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) || !isWorldVisible(obj)) return;
    _box.expandByObject(obj);
  });
  if (_box.isEmpty()) {
    return { halfH: 0.86, halfR: 0.28, cx: 0, cy: 0, cz: 0 };
  }
  _box.getSize(_size);
  _box.getCenter(_center);
  return {
    halfH: Math.max(_size.y / 2, 0.01),
    halfR: Math.max(_size.x, _size.z, 0.01) / 2,
    cx: _center.x,
    cy: _center.y,
    cz: _center.z,
  };
}

/**
 * Park the camera so the standing figure clears the frame on any aspect.
 * Height is the usual limiter; radius covers a side view after orbit.
 * 1 is the fitted full-body framing. Below that pulls back; above it moves in.
 */
export const PHYSIQUE_ZOOM_MIN = 0.64;
export const PHYSIQUE_ZOOM_MAX = 4;
const FRAME_PAD = 1.18;

export interface PhysiquePan {
  x: number;
  y: number;
}

export function clampPhysiqueZoom(zoom: number) {
  return THREE.MathUtils.clamp(zoom, PHYSIQUE_ZOOM_MIN, PHYSIQUE_ZOOM_MAX);
}

/**
 * How far the look target may slide, in world units, on both axes.
 * The fitted framing can still move; zooming in extends the range until
 * an edge of the figure can reach the middle of the frame.
 */
export function physiquePanLimit(
  envelope: PhysiqueEnvelope,
  zoom: number,
): PhysiquePan {
  const z = clampPhysiqueZoom(zoom);
  const t = THREE.MathUtils.clamp((Math.max(z, 1) - 1) / 2.4, 0, 1);
  const fitted = Math.min(z, 1);
  const yReach = THREE.MathUtils.lerp(0.58, 1.02, t) * fitted;
  const xReach = THREE.MathUtils.lerp(0.8, 1.15, t) * fitted;
  return {
    x: Math.max(envelope.halfR * 1.35, envelope.halfH * 0.42) * xReach,
    y: envelope.halfH * yReach,
  };
}

export function clampPhysiquePan(
  pan: PhysiquePan,
  envelope: PhysiqueEnvelope,
  zoom: number,
): PhysiquePan {
  const lim = physiquePanLimit(envelope, zoom);
  return {
    x: THREE.MathUtils.clamp(pan.x, -lim.x, lim.x),
    y: THREE.MathUtils.clamp(pan.y, -lim.y, lim.y),
  };
}

function frameMetrics(
  envelope: PhysiqueEnvelope,
  aspect: number,
  fovDeg: number,
  zoom: number,
  pad = FRAME_PAD,
) {
  const tan = Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2);
  const z = clampPhysiqueZoom(zoom);
  const safeAspect = Math.max(aspect, 0.2);
  const dist =
    Math.max(
      (envelope.halfH * pad) / tan,
      (envelope.halfR * pad) / (tan * safeAspect),
    ) / z;
  return { tan, dist };
}

/** World units covered by one screen pixel at this framing. */
export function physiqueWorldPerPixel(
  envelope: PhysiqueEnvelope,
  width: number,
  height: number,
  zoom: number,
  fovDeg: number,
): PhysiquePan {
  const aspect = Math.max(width / Math.max(height, 1), 0.2);
  const { tan, dist } = frameMetrics(envelope, aspect, fovDeg, zoom);
  const worldH = 2 * dist * tan;
  const worldW = worldH * aspect;
  return {
    x: worldW / Math.max(width, 1),
    y: worldH / Math.max(height, 1),
  };
}

/**
 * Keep the world point under a pinch in place as the zoom changes.
 * nx/ny are -1..1 from the view center, with +y toward the top of the screen.
 */
export function panToHoldZoomAnchor(
  pan: PhysiquePan,
  fromZoom: number,
  toZoom: number,
  nx: number,
  ny: number,
  width: number,
  height: number,
  envelope: PhysiqueEnvelope,
  fovDeg: number,
): PhysiquePan {
  const from = physiqueWorldPerPixel(
    envelope,
    width,
    height,
    fromZoom,
    fovDeg,
  );
  const to = physiqueWorldPerPixel(envelope, width, height, toZoom, fovDeg);
  return {
    x: pan.x + nx * (from.x - to.x) * width * 0.5,
    y: pan.y + ny * (from.y - to.y) * height * 0.5,
  };
}

export function fitPhysiqueCamera(
  camera: THREE.PerspectiveCamera,
  envelope: PhysiqueEnvelope,
  width: number,
  height: number,
  zoom = 1,
  pan: PhysiquePan = { x: 0, y: 0 },
  pad = FRAME_PAD,
) {
  const aspect = Math.max(width / Math.max(height, 1), 0.2);
  camera.aspect = aspect;
  const { dist } = frameMetrics(envelope, aspect, camera.fov, zoom, pad);
  const x = pan.x;
  const y = envelope.cy + pan.y;
  camera.position.set(x, y, dist);
  camera.lookAt(x, y, 0);
  camera.near = Math.max(dist * 0.05, 0.05);
  camera.far = Math.max(dist * 6, 12);
  camera.updateProjectionMatrix();
}

export interface PhysiqueMesh {
  mesh: THREE.Mesh;
  regionId: RegionId | null;
}

export type PhysiqueKind = "anatomy" | "figure";

export interface PreparedPhysique {
  root: THREE.Group;
  muscles: PhysiqueMesh[];
  kind: PhysiqueKind;
}

const sourcePromises = new Map<Gender, Promise<THREE.Group>>();

function extrasOf(obj: THREE.Object3D): {
  type?: string;
  name?: string;
  nameDetail?: string;
} {
  let current: THREE.Object3D | null = obj;
  while (current) {
    const data = current.userData as {
      type?: string;
      name?: string;
      nameDetail?: string;
    };
    if (data.type || data.name) return data;
    current = current.parent;
  }
  return {};
}

export function loadPhysiqueSource(gender: Gender = "male"): Promise<THREE.Group> {
  const cached = sourcePromises.get(gender);
  if (cached) return cached;

  const promise = (async () => {
    const draco = new DRACOLoader();
    draco.setDecoderPath(DRACO_PATH);
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    try {
      const url = gender === "female" ? FEMALE_URL : MALE_URL;
      const gltf = await loader.loadAsync(url);
      return gltf.scene;
    } catch (err) {
      sourcePromises.delete(gender);
      throw err;
    } finally {
      draco.dispose();
    }
  })();
  sourcePromises.set(gender, promise);
  return promise;
}

function fitPrepared(root: THREE.Group) {
  root.updateMatrixWorld(true);
  const raw = visibleEnvelope(root);
  const scale = FIT / Math.max(raw.halfH * 2, 0.001);
  root.scale.setScalar(scale);
  root.position.set(-raw.cx * scale, -raw.cy * scale, -raw.cz * scale);
}

export function preparePhysique(
  source: THREE.Group,
  gender: Gender = "male",
): PreparedPhysique {
  const root = source.clone(true);
  const muscles: PhysiqueMesh[] = [];

  if (gender === "female") {
    root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const name = obj.name.toLowerCase();
      if (name.includes("eye")) return;
      muscles.push({ mesh: obj, regionId: null });
    });
    fitPrepared(root);
    return { root, muscles, kind: "figure" };
  }

  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const meta = extrasOf(obj);
    if (meta.type !== "muscle") {
      obj.visible = false;
      return;
    }
    muscles.push({
      mesh: obj,
      regionId: regionFromAnatomy(meta.name, meta.nameDetail),
    });
  });
  fitPrepared(root);
  return { root, muscles, kind: "anatomy" };
}

/** Map a point on the female figure onto a training region. */
export function classifyFigureRegion(
  point: THREE.Vector3,
  env: PhysiqueEnvelope,
): RegionId | null {
  const height = env.halfH * 2;
  const y01 = THREE.MathUtils.clamp(
    (point.y - (env.cy - env.halfH)) / height,
    0,
    1,
  );
  const xN = point.x / Math.max(env.halfR, 0.01);
  const zN = point.z / Math.max(env.halfR, 0.01);
  const ax = Math.abs(xN);
  if (y01 > 0.84 || y01 < 0.07) return null;

  const arm = ax > 0.42 && y01 > 0.38 && y01 < 0.82;
  if (arm) {
    if (y01 < 0.58) return "forearms";
    if (y01 < 0.7) return zN >= 0 ? "biceps" : "triceps";
    if (zN > 0.12) return "front-delt";
    if (zN < -0.12) return "rear-delt";
    return "side-delt";
  }

  if (y01 < 0.28) return "calves";
  if (y01 < 0.5) return zN >= 0 ? "quads" : "hamstrings";
  if (y01 < 0.58) {
    if (zN < -0.05) return "glutes";
    return zN >= 0 ? "quads" : "hamstrings";
  }
  if (y01 < 0.68) {
    if (zN < -0.08) return ax > 0.18 ? "lats" : "lower-back";
    return "abs";
  }
  if (y01 < 0.76) {
    if (zN < -0.05) return ax > 0.16 ? "lats" : "traps";
    return "chest";
  }
  if (zN > 0.1) return "front-delt";
  if (zN < -0.1) return "rear-delt";
  if (ax > 0.22) return "side-delt";
  return "traps";
}

export function paintFigureMesh(
  entry: PhysiqueMesh,
  intensities: Record<RegionId, number>,
  selected: RegionId | null,
  env: PhysiqueEnvelope,
  rest: THREE.Object3D,
  base: THREE.Color,
  hot: THREE.Color,
) {
  const mesh = entry.mesh;
  const geo = mesh.geometry;
  const pos = geo.getAttribute("position");
  if (!pos) return;
  let color = geo.getAttribute("color") as THREE.BufferAttribute | undefined;
  if (!color || color.count !== pos.count) {
    color = new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3);
    geo.setAttribute("color", color);
  }
  mesh.updateWorldMatrix(true, false);
  const scratch = _tint;
  for (let i = 0; i < pos.count; i++) {
    _world.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    rest.worldToLocal(_world);
    const region = classifyFigureRegion(_world, env);
    const intensity = region ? (intensities[region] ?? 0) : 0;
    scratch.copy(base).lerp(hot, intensity);
    if (region && region === selected) scratch.lerp(hot, 0.35);
    color.setXYZ(i, scratch.r, scratch.g, scratch.b);
  }
  color.needsUpdate = true;
}
