import * as THREE from "three";
import { DUMBBELL_SIZES, type Unit } from "../../../lib/units";

/** 1 world unit = 1 cm. */
export const CM = 1;

/**
 * Turn a Y-axis primitive onto the bar's X axis. `rotateZ` already carries
 * the normal attribute through the normal matrix, so do not recompute
 * normals here: doing so replaces the lathe's per-segment normals with
 * vertex-averaged ones, which rounds off every bevel and face crease and
 * leaves stacked plates shading like one smooth blob.
 */
export function alongX<T extends THREE.BufferGeometry>(geo: T): T {
  geo.rotateZ(Math.PI / 2);
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

/** Camera-fit envelope: always the heaviest head, so mass reads as mass. */
export function dumbbellMaxHeadDims() {
  const sizes = DUMBBELL_SIZES.lb;
  return dumbbellHeadDims(sizes[sizes.length - 1], "lb");
}

export const BAR_LEN = 220;
export const SHAFT_R = 1.4;
export const SLEEVE_R = 2.5;
/**
 * Longer than a real Olympic sleeve (41cm). The reference's sleeve runs
 * 0.26 of the bar length, and it has to: at this view angle the outermost
 * plate's near rim projects almost as far out as the tip does, so a 41cm
 * sleeve leaves a loaded bar with no visible tip at all.
 */
export const SLEEVE_LEN = 50;
export const COLLAR_T = 1.6;
export const COLLAR_R = 3.6;
/** Collar center: sleeve begins at the outer face. */
export const COLLAR_X = BAR_LEN / 2 - SLEEVE_LEN;
export const PLATE_GAP = 0.18;
export const PLATE_HOLE_R = 2.55;

/* ---------- Barbell pose ----------
 * Measured off docs/3d/reference/barbell (see .img2threejs/reference-*.json):
 * the innermost plate face reads as an ellipse 0.19x as wide as it is tall,
 * which is a 10.9 degree view angle onto a face sitting 0.24 bar-lengths out
 * from centre. That pins the eye at 2.5x the half bar length. Everything else
 * here is framing, so it is safe to tune.
 */

/**
 * Eye distance as a multiple of the half bar length. This is what sets the
 * ellipse width, so it is the one number here that is not free: 2.7 puts the
 * innermost face at a 13 degree view angle, i.e. an ellipse 0.23x as wide as
 * it is tall, which is what the reference measures.
 */
export const BAR_CAM_DISTANCE_FACTOR = 2.7;
export const BAR_CAM_DISTANCE = (BAR_LEN / 2) * BAR_CAM_DISTANCE_FACTOR;
/** Looking very slightly down the plates, enough to round the top of the stack. */
export const BAR_CAM_ELEVATION_DEG = 3;
/** Empty margin beyond the sleeve tips / plate rims, as a fraction per side. */
export const BAR_CAM_PAD_X = 1.08;
export const BAR_CAM_PAD_Y = 1.14;
/** Hard ceiling on pointer parallax. The pose is the design; this is a nudge. */
export const BAR_CAM_PARALLAX_DEG = 2;

const _box = new THREE.Box3();
const _corner = new THREE.Vector3();

/**
 * Park a perspective camera on the bar's midline and widen the FOV until the
 * whole bar fits. Distance and elevation are fixed by the pose, so only the
 * FOV reacts to the element's size — that keeps the plate ellipses identical
 * at every breakpoint instead of letting the framing change the pose.
 */
export function fitBarbellCamera(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  width: number,
  height: number,
) {
  const d = BAR_CAM_DISTANCE;
  const elev = THREE.MathUtils.degToRad(BAR_CAM_ELEVATION_DEG);
  camera.position.set(0, d * Math.sin(elev), d * Math.cos(elev));
  camera.lookAt(0, 0, 0);
  camera.near = d * 0.2;
  camera.far = d * 3;
  camera.aspect = Math.max(width / Math.max(height, 1), 0.2);
  camera.updateMatrixWorld(true);

  object.updateWorldMatrix(true, true);
  _box.setFromObject(object);
  if (_box.isEmpty()) {
    camera.updateProjectionMatrix();
    return;
  }

  // Fit against the box corners in view space rather than a flat half-width:
  // the plate rims lean toward the eye, so they need more angle per unit of
  // world x than the sleeve tips do.
  let tanH = 1e-4;
  let tanV = 1e-4;
  for (const x of [_box.min.x, _box.max.x]) {
    for (const y of [_box.min.y, _box.max.y]) {
      for (const z of [_box.min.z, _box.max.z]) {
        _corner.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
        const depth = Math.max(-_corner.z, 1e-3);
        tanH = Math.max(tanH, (Math.abs(_corner.x) / depth) * BAR_CAM_PAD_X);
        tanV = Math.max(tanV, (Math.abs(_corner.y) / depth) * BAR_CAM_PAD_Y);
      }
    }
  }
  // Clamped so one bad frame — a mid-animation bounding box, a zero-sized
  // host — cannot leave the pose stuck at a degenerate FOV.
  camera.fov = THREE.MathUtils.clamp(
    THREE.MathUtils.radToDeg(2 * Math.atan(Math.max(tanV, tanH / camera.aspect))),
    1,
    60,
  );
  camera.updateProjectionMatrix();
}

/**
 * Re-aim the fixed bar camera with a parallax offset. `t` in [-1, 1] maps to
 * the elevation cap, so t = 0 is the exact symmetric rest pose. x stays 0.
 */
export function aimBarbellCamera(camera: THREE.PerspectiveCamera, t: number) {
  const d = BAR_CAM_DISTANCE;
  const elev =
    THREE.MathUtils.degToRad(BAR_CAM_ELEVATION_DEG) +
    THREE.MathUtils.degToRad(BAR_CAM_PARALLAX_DEG) *
      THREE.MathUtils.clamp(t, -1, 1);
  camera.position.set(0, d * Math.sin(elev), d * Math.cos(elev));
  camera.lookAt(0, 0, 0);
}

/**
 * Training-bumper thicknesses (cm). Diameter still grows with weight so
 * change plates read smaller; thickness is what makes a tap land and a
 * 45 look like a bumper instead of a steel disc.
 */
const PLATE_TABLE: { lb: number; d: number; t: number }[] = [
  { lb: 2.5, d: 15, t: 2.25 },
  { lb: 5, d: 20, t: 2.9 },
  { lb: 10, d: 26, t: 3.8 },
  { lb: 25, d: 34, t: 5.6 },
  { lb: 35, d: 39, t: 6.5 },
  { lb: 45, d: 45, t: 7.2 },
];

/** Sleeve left clear beyond the outermost plate, so the tip always reads. */
export const SLEEVE_TIP_MARGIN = 1.6;

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
    t = 7.2 + extra * 0.045;
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
