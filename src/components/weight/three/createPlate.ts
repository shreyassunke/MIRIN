import * as THREE from "three";
import { plateColor, type Unit } from "../../../lib/units";
import { hubMaterial, plateMaterial } from "./materials";
import { alongX, plateWorldDims } from "./scale";
import { addPlateFaces } from "./stamp";

const SEG = 64;
const plateGeoCache = new Map<string, THREE.BufferGeometry>();
const hubGeoCache = new Map<string, THREE.BufferGeometry>();

function bumperGeometry(radius: number, thickness: number, bore: number) {
  const key = `v10:${radius.toFixed(3)}:${thickness.toFixed(3)}:${bore.toFixed(3)}`;
  const hit = plateGeoCache.get(key);
  if (hit) return hit;
  const half = thickness / 2;
  const lipH = Math.min(0.48, half * 0.22);
  const groove = Math.min(0.24, half * 0.1);
  const rimW = radius * 0.2;
  const innerW = Math.min(Math.max(bore * 0.65, radius * 0.1), radius * 0.16);
  const innerOut = bore + innerW;
  const faceOuter = radius - rimW;
  const points: THREE.Vector2[] = [];
  const push = (x: number, y: number) => points.push(new THREE.Vector2(x, y));

  // Competition bumper: recessed face, raised hub flange, raised outer
  // lip, pickup groove on the sidewall. Both faces are the same profile.
  push(bore, -half);
  push(bore + innerW * 0.3, -half);
  push(innerOut, -(half - lipH));
  push(faceOuter, -(half - lipH));
  push(faceOuter, -half);
  push(radius, -half);
  push(radius, -half + lipH * 0.4);
  push(radius - groove, 0);
  push(radius, half - lipH * 0.4);
  push(radius, half);
  push(faceOuter, half);
  push(faceOuter, half - lipH);
  push(innerOut, half - lipH);
  push(bore + innerW * 0.3, half);
  push(bore, half);
  push(bore, -half);

  const geo = alongX(new THREE.LatheGeometry(points, SEG));
  geo.userData.shared = true;
  plateGeoCache.set(key, geo);
  return geo;
}

/** Steel insert around the Olympic bore. The sleeve reads through the hole. */
function hubInsertGeometry(thickness: number, hole: number, insert: number) {
  const key = `v6:${thickness.toFixed(3)}:${hole.toFixed(3)}:${insert.toFixed(3)}`;
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

export type CreatePlateOpts = {
  stampInboard?: boolean;
  stampOutboard?: boolean;
  /** Un-mirror stamps when the plate lives under scale.x = -1. */
  unmirror?: boolean;
};

/** One bumper, same mesh the loaded bar uses. Axis along X. */
export function createPlate(
  value: number,
  unit: Unit,
  opts?: CreatePlateOpts,
): THREE.Group {
  const dims = plateWorldDims(value, unit);
  const { radius, thickness, hole, insert } = dims;
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
  if (opts?.stampInboard || opts?.stampOutboard) {
    addPlateFaces(group, value, hex, dims, thickness / 2, {
      inboard: !!opts.stampInboard,
      outboard: !!opts.stampOutboard,
      unmirror: !!opts.unmirror,
    });
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
