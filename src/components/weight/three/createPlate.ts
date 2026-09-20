import * as THREE from "three";
import { plateColor, type Unit } from "../../../lib/units";
import { hubMaterial, plateMaterial } from "./materials";
import { alongX, plateWorldDims } from "./scale";
import { addPlateFaces } from "./stamp";

const SEG = 64;
const plateGeoCache = new Map<string, THREE.BufferGeometry>();
const hubGeoCache = new Map<string, THREE.BufferGeometry>();

/** Outer radius of the steel insert; the coloured body starts here. */
const hubRadius = (hole: number) => hole * 1.55;

function bumperGeometry(radius: number, thickness: number, hole: number) {
  const key = `${radius.toFixed(3)}:${thickness.toFixed(3)}:${hole.toFixed(3)}`;
  const hit = plateGeoCache.get(key);
  if (hit) return hit;
  const bore = hubRadius(hole);
  const half = thickness / 2;
  const bevel = Math.min(0.9, half * 0.24, radius * 0.045);
  const points: THREE.Vector2[] = [];
  const push = (x: number, y: number) => points.push(new THREE.Vector2(x, y));

  // Bore, face, then a shouldered chamfer out to the rim. The extra mid
  // point turns the chamfer into a curved shoulder, so the edge picks up a
  // gradient instead of one flat highlight — that is what makes the stack
  // read as separate discs at a near edge-on view.
  //
  // The profile has to return to its start: a lathe only spins the polyline
  // it is given, so an unclosed profile leaves the far face open and the
  // plate reads as a hollow shell the moment the camera is off-axis.
  push(bore, -half);
  push(bore, half);
  push(radius - bevel, half);
  push(radius - bevel * 0.38, half - bevel * 0.14);
  push(radius, half - bevel);
  push(radius, -half + bevel);
  push(radius - bevel * 0.38, -half + bevel * 0.14);
  push(radius - bevel, -half);
  push(bore, -half);

  const geo = alongX(new THREE.LatheGeometry(points, SEG));
  geo.userData.shared = true;
  plateGeoCache.set(key, geo);
  return geo;
}

/** Steel insert around the bore: the ring that reads on the visible face. */
function hubGeometry(thickness: number, hole: number) {
  const key = `${thickness.toFixed(3)}:${hole.toFixed(3)}`;
  const hit = hubGeoCache.get(key);
  if (hit) return hit;
  // Fills the bore the coloured body leaves open, and stands 0.2mm proud of
  // each face so the insert reads as a ring rather than melting into the
  // plate. Anything taller would touch its neighbour across the gap.
  const half = thickness / 2 + 0.02;
  const outer = hubRadius(hole) + 0.01;
  const lip = Math.min(0.15, hole * 0.06);
  const points = [
    new THREE.Vector2(hole, -half),
    new THREE.Vector2(hole, half),
    new THREE.Vector2(outer - lip, half),
    new THREE.Vector2(outer, half - lip),
    new THREE.Vector2(outer, -half + lip),
    new THREE.Vector2(outer - lip, -half),
    new THREE.Vector2(hole, -half),
  ];
  const geo = alongX(new THREE.LatheGeometry(points, 48));
  geo.userData.shared = true;
  hubGeoCache.set(key, geo);
  return geo;
}

/** One bumper, same mesh the loaded bar uses. Axis along X. */
export function createPlate(value: number, unit: Unit): THREE.Group {
  const { radius, thickness, hole } = plateWorldDims(value, unit);
  const hex = plateColor(unit, value);
  const group = new THREE.Group();
  group.add(new THREE.Mesh(bumperGeometry(radius, thickness, hole), plateMaterial(hex)));
  group.add(new THREE.Mesh(hubGeometry(thickness, hole), hubMaterial()));
  addPlateFaces(group, value, hex, radius, hole, thickness / 2 + 0.02);
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
