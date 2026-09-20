import * as THREE from "three";
import { plateColor, type Unit } from "../../../lib/units";
import { hubMaterial, plateMaterial } from "./materials";
import { alongX, plateWorldDims } from "./scale";
import { addPlateFaces } from "./stamp";

const SEG = 64;
const plateGeoCache = new Map<string, THREE.BufferGeometry>();
const hubGeoCache = new Map<string, THREE.BufferGeometry>();
const hubCapGeoCache = new Map<string, THREE.BufferGeometry>();

let hubCapMat: THREE.MeshStandardMaterial | null = null;
function hubCapMaterial() {
  if (hubCapMat) return hubCapMat;
  hubCapMat = hubMaterial().clone();
  hubCapMat.name = "hub-cap3";
  hubCapMat.polygonOffset = true;
  hubCapMat.polygonOffsetFactor = -2;
  hubCapMat.polygonOffsetUnits = -2;
  return hubCapMat;
}

function bumperGeometry(radius: number, thickness: number, bore: number) {
  const key = `v5:${radius.toFixed(3)}:${thickness.toFixed(3)}:${bore.toFixed(3)}`;
  const hit = plateGeoCache.get(key);
  if (hit) return hit;
  const half = thickness / 2;
  // Tight chamfer: enough for a rim highlight, not enough to open a
  // sightline to the sleeve between packed faces.
  const bevel = Math.min(0.26, half * 0.08, radius * 0.012);
  const points: THREE.Vector2[] = [];
  const push = (x: number, y: number) => points.push(new THREE.Vector2(x, y));

  push(bore, -half);
  push(bore, half);
  push(radius - bevel, half);
  push(radius, half - bevel);
  push(radius, -half + bevel);
  push(radius - bevel, -half);
  push(bore, -half);

  const geo = alongX(new THREE.LatheGeometry(points, SEG));
  geo.userData.shared = true;
  plateGeoCache.set(key, geo);
  return geo;
}

/** Steel insert filling the Olympic bore. Caps on the faces hide the sleeve. */
function hubInsertGeometry(thickness: number, hole: number, insert: number) {
  const key = `v5:${thickness.toFixed(3)}:${hole.toFixed(3)}:${insert.toFixed(3)}`;
  const hit = hubGeoCache.get(key);
  if (hit) return hit;
  const half = thickness / 2 - 0.04;
  const points = [
    new THREE.Vector2(hole, -half),
    new THREE.Vector2(hole, half),
    new THREE.Vector2(insert, half),
    new THREE.Vector2(insert, -half),
    new THREE.Vector2(hole, -half),
  ];
  const geo = alongX(new THREE.LatheGeometry(points, 48));
  geo.userData.shared = true;
  hubGeoCache.set(key, geo);
  return geo;
}

function hubCapGeometry(radius: number) {
  const key = `v5:${radius.toFixed(3)}`;
  const hit = hubCapGeoCache.get(key);
  if (hit) return hit;
  const geo = new THREE.CircleGeometry(radius, 48);
  geo.userData.shared = true;
  hubCapGeoCache.set(key, geo);
  return geo;
}

function addHubCaps(
  parent: THREE.Object3D,
  insert: number,
  faceX: number,
) {
  const geo = hubCapGeometry(insert + 0.06);
  const mat = hubCapMaterial();
  for (const side of [1, -1] as const) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.order = "YXZ";
    mesh.rotation.set(0, (side * Math.PI) / 2, 0);
    mesh.position.x = side * faceX;
    mesh.name = side === 1 ? "hubCapOut" : "hubCapIn";
    mesh.raycast = () => {};
    parent.add(mesh);
  }
}

export type CreatePlateOpts = {
  /** Inboard denomination stamp. Off for every plate behind the first of its weight. */
  stamp?: boolean;
};

/** One bumper, same mesh the loaded bar uses. Axis along X. */
export function createPlate(
  value: number,
  unit: Unit,
  opts?: CreatePlateOpts,
): THREE.Group {
  const { radius, thickness, hole, insert } = plateWorldDims(value, unit);
  const hex = plateColor(unit, value);
  const group = new THREE.Group();
  group.add(
    new THREE.Mesh(
      bumperGeometry(radius, thickness, insert),
      plateMaterial(hex),
    ),
  );
  const liner = new THREE.Mesh(
    hubInsertGeometry(thickness, hole, insert),
    hubMaterial(),
  );
  liner.name = "hubInsert";
  group.add(liner);
  addHubCaps(group, insert, thickness / 2);
  if (opts?.stamp) {
    addPlateFaces(group, value, hex, radius, insert, thickness / 2);
  }
  group.userData.radius = radius;
  group.userData.thickness = thickness;
  group.userData.value = value;
  return group;
}

export function disposeUnsharedPlate(root: THREE.Object3D) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    if (!child.geometry.userData.shared) child.geometry.dispose();
    const mat = child.material;
    if (mat && !Array.isArray(mat) && !mat.name) mat.dispose();
  });
}
