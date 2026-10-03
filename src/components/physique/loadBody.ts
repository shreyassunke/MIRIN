import * as THREE from "three";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { regionFromAnatomy, type RegionId } from "../../lib/muscleRegions";

const MODEL_URL = "/models/body.glb";
const DRACO_PATH = "/draco/";
const FIT = 1.72;

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

export function preparePhysique(source: THREE.Group): {
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
  const raw = visibleEnvelope(root);
  const scale = FIT / Math.max(raw.halfH * 2, 0.001);
  root.scale.setScalar(scale);
  root.position.set(-raw.cx * scale, -raw.cy * scale, -raw.cz * scale);

  return { root, muscles };
}
