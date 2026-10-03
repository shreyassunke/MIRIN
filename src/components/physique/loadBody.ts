import * as THREE from "three";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { Gender } from "../../lib/body";
import { regionFromAnatomy, type RegionId } from "../../lib/muscleRegions";

const MODEL_URL = "/models/body.glb";
const DRACO_PATH = "/draco/";
const FIT = 1.72;

const TORSO_REGIONS = new Set<RegionId>([
  "chest",
  "abs",
  "lats",
  "traps",
  "lower-back",
  "glutes",
]);
const SHOULDER_REGIONS = new Set<RegionId>([
  "front-delt",
  "side-delt",
  "rear-delt",
]);
const LEG_REGIONS = new Set<RegionId>(["quads", "hamstrings"]);

const _world = new THREE.Vector3();
const _inv = new THREE.Matrix4();

const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _center = new THREE.Vector3();

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

let sourcePromise: Promise<THREE.Group> | null = null;

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

export function loadPhysiqueSource(): Promise<THREE.Group> {
  if (!sourcePromise) {
    sourcePromise = (async () => {
      const draco = new DRACOLoader();
      draco.setDecoderPath(DRACO_PATH);
      const loader = new GLTFLoader();
      loader.setDRACOLoader(draco);
      try {
        const gltf = await loader.loadAsync(MODEL_URL);
        return gltf.scene;
      } catch (err) {
        sourcePromise = null;
        throw err;
      } finally {
        draco.dispose();
      }
    })();
  }
  return sourcePromise;
}

export function preparePhysique(
  source: THREE.Group,
  gender: Gender = "male",
): {
  root: THREE.Group;
  muscles: PhysiqueMesh[];
} {
  const root = source.clone(true);
  const muscles: PhysiqueMesh[] = [];

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

  root.updateMatrixWorld(true);
  if (gender === "female") applyFemalePhysique(root, muscles);
  const raw = visibleEnvelope(root);
  const scale = FIT / Math.max(raw.halfH * 2, 0.001);
  root.scale.setScalar(scale);
  root.position.set(-raw.cx * scale, -raw.cy * scale, -raw.cz * scale);

  return { root, muscles };
}

function lerpKeys(y: number, keys: readonly (readonly [number, number])[]) {
  if (y <= keys[0][0]) return keys[0][1];
  const last = keys[keys.length - 1];
  if (y >= last[0]) return last[1];
  for (let i = 1; i < keys.length; i++) {
    const [y1, v1] = keys[i - 1];
    const [y2, v2] = keys[i];
    if (y <= y2) {
      return THREE.MathUtils.lerp(v1, v2, (y - y1) / (y2 - y1));
    }
  }
  return last[1];
}

/** Narrower shoulders, cinched waist, wider hips — same named muscles. */
function applyFemalePhysique(root: THREE.Group, muscles: PhysiqueMesh[]) {
  const env = visibleEnvelope(root);
  const y0 = env.cy - env.halfH;
  const height = Math.max(env.halfH * 2, 0.001);
  const xKeys = [
    [0.0, 0.95],
    [0.32, 0.92],
    [0.46, 1.06],
    [0.54, 1.3],
    [0.62, 0.78],
    [0.7, 0.88],
    [0.78, 0.74],
    [0.9, 0.9],
    [1.0, 0.93],
  ] as const;
  const zKeys = [
    [0.0, 0.95],
    [0.5, 1.08],
    [0.54, 1.16],
    [0.62, 0.88],
    [0.7, 1.08],
    [0.78, 0.9],
    [1.0, 0.93],
  ] as const;

  for (const entry of muscles) {
    const mesh = entry.mesh;
    const geo = mesh.geometry.clone();
    mesh.geometry = geo;
    const pos = geo.getAttribute("position");
    if (!pos) continue;
    mesh.updateWorldMatrix(true, false);
    _inv.copy(mesh.matrixWorld).invert();
    for (let i = 0; i < pos.count; i++) {
      _world.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      const y01 = THREE.MathUtils.clamp((_world.y - y0) / height, 0, 1);
      const region = entry.regionId;
      if (region && TORSO_REGIONS.has(region)) {
        _world.x *= lerpKeys(y01, xKeys);
        _world.z *= lerpKeys(y01, zKeys);
        if (region === "chest" && _world.z > 0) {
          const band = Math.exp(-(((y01 - 0.69) / 0.05) ** 2));
          const side = Math.min(Math.abs(_world.x) / Math.max(env.halfR * 0.5, 0.01), 1);
          _world.z += height * 0.058 * band * (0.3 + 0.7 * side);
        }
        if (region === "glutes" && _world.z < 0) {
          const band = Math.exp(-(((y01 - 0.53) / 0.045) ** 2));
          _world.z -= height * 0.048 * band;
          _world.x *= 1.08;
        }
      } else if (region && SHOULDER_REGIONS.has(region)) {
        _world.x *= 0.78;
      } else if (region && LEG_REGIONS.has(region)) {
        const hip = THREE.MathUtils.smoothstep(0.42, 0.56, y01);
        _world.x *= 1 + 0.18 * hip;
        const knee = Math.max(0, 1 - Math.abs(y01 - 0.33) / 0.07);
        _world.x *= 1 - 0.05 * knee;
      } else if (!region && y01 > 0.83) {
        _world.x *= 0.93;
        _world.z *= 0.93;
      }
      _world.applyMatrix4(_inv);
      pos.setXYZ(i, _world.x, _world.y, _world.z);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }
}
