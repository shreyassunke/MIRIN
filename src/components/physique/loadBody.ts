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
 */
export const PHYSIQUE_ZOOM_MIN = 1;
export const PHYSIQUE_ZOOM_MAX = 2.8;

export function fitPhysiqueCamera(
  camera: THREE.PerspectiveCamera,
  envelope: PhysiqueEnvelope,
  width: number,
  height: number,
  zoom = 1,
  pad = 1.18,
) {
  camera.aspect = Math.max(width / Math.max(height, 1), 0.2);
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const z = THREE.MathUtils.clamp(zoom, PHYSIQUE_ZOOM_MIN, PHYSIQUE_ZOOM_MAX);
  const dist =
    Math.max(
      (envelope.halfH * pad) / tan,
      (envelope.halfR * pad) / (tan * camera.aspect),
    ) / z;
  camera.position.set(0, envelope.cy, dist);
  camera.lookAt(0, envelope.cy, 0);
  camera.near = Math.max(dist * 0.05, 0.05);
  camera.far = dist * 6;
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
