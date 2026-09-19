import * as THREE from "three";
import { DUMBBELL_SIZES, type Unit } from "../../../lib/units";

/** 1 world unit = 1 cm. */
export const CM = 1;

export function alongX<T extends THREE.BufferGeometry>(geo: T): T {
  geo.rotateZ(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/** Grip between collar inner faces. */
export const DB_HANDLE_LEN = 14;
export const DB_HANDLE_R = 1.5;
export const DB_COLLAR_T = 0.8;
export const DB_COLLAR_R = 1.9;
export const DB_CHAMFER = 0.45;

export function dumbbellHeadDims(value: number, unit: Unit) {
  const sizes = DUMBBELL_SIZES[unit];
  const t = Math.max(0, Math.min(1, value / sizes[sizes.length - 1]));
  const diameter = DB_HANDLE_LEN * (0.98 + 0.28 * Math.pow(t, 0.55));
  return {
    radius: diameter / 2,
    thickness: 4.6 + 2.2 * Math.pow(t, 0.7),
    chamfer: DB_CHAMFER,
  };
}

export const BAR_LEN = 220;
export const SHAFT_R = 1.4;
export const SLEEVE_R = 2.5;
export const SLEEVE_LEN = 41;
export const COLLAR_T = 1.6;
export const COLLAR_R = 3.6;
/** Collar center: sleeve begins at the outer face. */
export const COLLAR_X = BAR_LEN / 2 - SLEEVE_LEN;
export const PLATE_GAP = 0.15;
export const PLATE_HOLE_R = 2.55;

const PLATE_TABLE: { lb: number; d: number; t: number }[] = [
  { lb: 2.5, d: 15, t: 1.2 },
  { lb: 5, d: 20, t: 1.5 },
  { lb: 10, d: 26, t: 1.8 },
  { lb: 25, d: 34, t: 2.2 },
  { lb: 35, d: 39, t: 2.4 },
  { lb: 45, d: 45, t: 2.8 },
];

export function plateWorldDims(value: number, unit: Unit) {
  const lb = unit === "lb" ? value : value * 2.2046226218;
  let d: number;
  let t: number;
  if (lb <= PLATE_TABLE[0].lb) {
    d = PLATE_TABLE[0].d;
    t = PLATE_TABLE[0].t;
  } else if (lb >= PLATE_TABLE[PLATE_TABLE.length - 1].lb) {
    const extra = lb - 45;
    d = 45 + extra * 0.15;
    t = 2.8 + extra * 0.02;
  } else {
    let i = 1;
    while (i < PLATE_TABLE.length && PLATE_TABLE[i].lb < lb) i += 1;
    const a = PLATE_TABLE[i - 1];
    const b = PLATE_TABLE[i];
    const u = (lb - a.lb) / (b.lb - a.lb);
    d = a.d + (b.d - a.d) * u;
    t = a.t + (b.t - a.t) * u;
  }
  return {
    radius: d / 2,
    thickness: t,
    hole: PLATE_HOLE_R,
    insert: Math.min(d * 0.11, 5.8),
    rim: d * 0.045,
  };
}

export function fitOrthoCamera(
  camera: THREE.OrthographicCamera,
  object: THREE.Object3D,
  width: number,
  height: number,
  padding = 1.15,
) {
  object.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const aspect = Math.max(width / Math.max(height, 1), 0.2);
  const halfW = (size.x * padding) / 2 || 1;
  const halfH = (size.y * padding) / 2 || 1;
  const contentAspect = halfW / halfH;
  if (aspect >= contentAspect) {
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.left = -halfH * aspect;
    camera.right = halfH * aspect;
  } else {
    camera.left = -halfW;
    camera.right = halfW;
    camera.top = halfW / aspect;
    camera.bottom = -halfW / aspect;
  }
  const depth = Math.max(size.z, 20);
  camera.position.set(center.x, center.y, center.z + depth + 80);
  camera.near = 1;
  camera.far = depth + 200;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}
