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
/** Plates seat flush against the collar and each other. No spacers. */
export const PLATE_HOLE_R = 2.55;

/* ---------- Fixed product-shot pose ----------
 * Camera sits on the object's midline and looks slightly down it, so a disc
 * whose normal is the shaft reads as an ellipse instead of a line. A face at
 * `faceX` foreshortens to faceX / hypot(faceX, D). Distance is the one number
 * that is not free; elevation and padding are framing.
 */

export type FixedCamPose = {
  distance: number;
  elevationDeg: number;
  padX: number;
  padY: number;
  parallaxDeg: number;
};

/**
 * Eye distance as a multiple of the half bar length. The innermost plate face
 * sits at COLLAR_X + COLLAR_T / 2 = 60.8, so 2.35 (D = 258.5) gives 0.229 —
 * the reference's 0.23 (docs/3d/barbell-pose-reference.json).
 */
export const BAR_CAM_DISTANCE_FACTOR = 2.35;
export const BAR_CAM_DISTANCE = (BAR_LEN / 2) * BAR_CAM_DISTANCE_FACTOR;
/** Looking very slightly down the plates, enough to round the top of the stack. */
export const BAR_CAM_ELEVATION_DEG = 3;
/** Empty margin beyond the sleeve tips / plate rims, as a fraction per side. */
export const BAR_CAM_PAD_X = 1.08;
export const BAR_CAM_PAD_Y = 1.14;
/** Hard ceiling on pointer parallax. The pose is the design; this is a nudge. */
export const BAR_CAM_PARALLAX_DEG = 2;

export const BARBELL_CAM: FixedCamPose = {
  distance: BAR_CAM_DISTANCE,
  elevationDeg: BAR_CAM_ELEVATION_DEG,
  padX: BAR_CAM_PAD_X,
  padY: BAR_CAM_PAD_Y,
  parallaxDeg: BAR_CAM_PARALLAX_DEG,
};

/** Inner face of either urethane head, seated against the collar. */
export const DB_INNER_FACE_X = DB_HANDLE_LEN / 2 + DB_COLLAR_T;
/** Outer face of the heaviest head — the most face-on disc, so it sets distance. */
export const DB_OUTER_FACE_X = DB_INNER_FACE_X + dumbbellMaxHeadDims().thickness;
/**
 * A close camera opened the outer faces to ~0.48 (almost 3/4), so the pucks
 * read as discs on a diagonal. Distance is set so the outer face of the
 * heaviest head foreshortens to this, matching the side-on reference.
 */
export const DB_CAM_FACE_ELLIPSE = 0.2;
export const DB_CAM_DISTANCE =
  DB_OUTER_FACE_X *
  Math.sqrt(1 / (DB_CAM_FACE_ELLIPSE * DB_CAM_FACE_ELLIPSE) - 1);
export const DB_CAM_ELEVATION_DEG = 2;
export const DB_CAM_PAD_X = 1.1;
export const DB_CAM_PAD_Y = 1.16;
export const DB_CAM_PARALLAX_DEG = 2;

export const DUMBBELL_CAM: FixedCamPose = {
  distance: DB_CAM_DISTANCE,
  elevationDeg: DB_CAM_ELEVATION_DEG,
  padX: DB_CAM_PAD_X,
  padY: DB_CAM_PAD_Y,
  parallaxDeg: DB_CAM_PARALLAX_DEG,
};

const _box = new THREE.Box3();
const _corner = new THREE.Vector3();

/**
 * Park a perspective camera on the object's midline and widen the FOV until
 * the whole thing fits. Distance and elevation stay put, so the face ellipses
 * are identical at every breakpoint — framing cannot change the pose.
 */
export function fitFixedCamera(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  width: number,
  height: number,
  pose: FixedCamPose = BARBELL_CAM,
) {
  const d = pose.distance;
  const elev = THREE.MathUtils.degToRad(pose.elevationDeg);
  camera.position.set(0, d * Math.sin(elev), d * Math.cos(elev));
  camera.lookAt(0, 0, 0);
  camera.near = d * 0.2;
  camera.far = d * 3;
  camera.aspect = Math.max(width / Math.max(height, 1), 0.2);
  camera.updateMatrixWorld(true);

  object.updateWorldMatrix(true, true);
  const envelope = object.getObjectByName("fitBounds") ?? object;
  _box.setFromObject(envelope);
  if (_box.isEmpty()) {
    camera.updateProjectionMatrix();
    return;
  }

  // Fit against the envelope corners in view space rather than a flat
  // half-width: the rims lean toward the eye, so they need more angle per
  // unit of world x than the tips do. A named `fitBounds` child is the
  // authored envelope; without it the live bounding box is used.
  let tanH = 1e-4;
  let tanV = 1e-4;
  for (const x of [_box.min.x, _box.max.x]) {
    for (const y of [_box.min.y, _box.max.y]) {
      for (const z of [_box.min.z, _box.max.z]) {
        _corner.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
        const depth = Math.max(-_corner.z, 1e-3);
        tanH = Math.max(tanH, (Math.abs(_corner.x) / depth) * pose.padX);
        tanV = Math.max(tanV, (Math.abs(_corner.y) / depth) * pose.padY);
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
 * Re-aim a fixed camera with a parallax offset. `t` in [-1, 1] maps to the
 * elevation cap, so t = 0 is the exact symmetric rest pose. x stays 0.
 */
export function aimFixedCamera(
  camera: THREE.PerspectiveCamera,
  t: number,
  pose: FixedCamPose = BARBELL_CAM,
) {
  const d = pose.distance;
  const elev =
    THREE.MathUtils.degToRad(pose.elevationDeg) +
    THREE.MathUtils.degToRad(pose.parallaxDeg) * THREE.MathUtils.clamp(t, -1, 1);
  camera.position.set(0, d * Math.sin(elev), d * Math.cos(elev));
  camera.lookAt(0, 0, 0);
}

export function fitBarbellCamera(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  width: number,
  height: number,
) {
  fitFixedCamera(camera, object, width, height, BARBELL_CAM);
}

export function aimBarbellCamera(camera: THREE.PerspectiveCamera, t: number) {
  aimFixedCamera(camera, t, BARBELL_CAM);
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
    // Steel hub has to outrun the Olympic hole on every denomination,
    // including change plates whose diameter would otherwise undershoot it.
    insert: Math.max(PLATE_HOLE_R + 0.75, Math.min(d * 0.09, 4.0)),
    rim: d * 0.045,
  };
}

/**
 * Largest plate the picker can load (25 kg is a hair over a 45 lb bumper).
 * The camera fits this envelope whether the bar is empty or stacked, so
 * adding a plate cannot change the instrument's size on screen.
 */
export function barbellFitRadius() {
  return Math.max(
    plateWorldDims(45, "lb").radius,
    plateWorldDims(25, "kg").radius,
  );
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
