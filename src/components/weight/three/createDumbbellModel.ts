import * as THREE from "three";
import { DUMBBELL_SIZES, type Unit } from "../../../lib/units";
import { collarMaterial, headMaterial, steelMaterial } from "./materials";

export const HANDLE_RADIUS = 0.018;
export const HANDLE_HALF = 0.2;
export const COLLAR_GAP = 0.012;

const headGeoCache = new Map<string, THREE.BufferGeometry>();

/** Same growth curve as the SVG `DumbbellIcon`. */
export function headWorldDims(value: number, unit: Unit) {
  const sizes = DUMBBELL_SIZES[unit];
  const fraction = value / sizes[sizes.length - 1];
  const t = Math.max(0, Math.min(1, fraction));
  return {
    radius: 0.078 + 0.125 * Math.pow(t, 0.8),
    thickness: 0.036 + 0.052 * t,
    collarRadius: 0.052 + 0.085 * Math.pow(t, 0.8),
    collarThick: 0.01,
  };
}

function headGeometry(radius: number, thickness: number): THREE.BufferGeometry {
  const key = `${radius.toFixed(4)}:${thickness.toFixed(4)}`;
  const hit = headGeoCache.get(key);
  if (hit) return hit;
  const half = thickness / 2;
  const points = [
    new THREE.Vector2(0.004, -half),
    new THREE.Vector2(radius * 0.92, -half),
    new THREE.Vector2(radius, -half * 0.45),
    new THREE.Vector2(radius, half * 0.45),
    new THREE.Vector2(radius * 0.92, half),
    new THREE.Vector2(0.004, half),
  ];
  const geo = new THREE.LatheGeometry(points, 28);
  geo.rotateZ(Math.PI / 2);
  headGeoCache.set(key, geo);
  return geo;
}

export type DumbbellRuntime = {
  nodes: Record<string, THREE.Object3D>;
  setWeight: (value: number, unit: Unit) => void;
  dispose: () => void;
};

export function createDumbbellModel(): THREE.Group {
  const root = new THREE.Group();
  root.name = "MIRIN Dumbbell";

  const steel = steelMaterial("db-steel");
  const owned: THREE.BufferGeometry[] = [];

  const handleLen = HANDLE_HALF * 2;
  const handleGeo = new THREE.CylinderGeometry(
    HANDLE_RADIUS,
    HANDLE_RADIUS,
    handleLen,
    20,
  );
  handleGeo.rotateZ(Math.PI / 2);
  owned.push(handleGeo);
  const handle = new THREE.Mesh(handleGeo, steel);
  handle.name = "handle";
  root.add(handle);

  const headL = new THREE.Group();
  headL.name = "headLeft";
  root.add(headL);
  const headR = new THREE.Group();
  headR.name = "headRight";
  root.add(headR);

  const collarL = new THREE.Mesh();
  collarL.name = "collarLeft";
  const collarR = new THREE.Mesh();
  collarR.name = "collarRight";
  const collarMat = collarMaterial();
  collarL.material = collarMat;
  collarR.material = collarMat;
  root.add(collarL, collarR);

  const headMat = headMaterial();
  const collarGeos: THREE.BufferGeometry[] = [];

  const setWeight = (value: number, unit: Unit) => {
    const { radius, thickness, collarRadius, collarThick } = headWorldDims(
      value,
      unit,
    );
    const geo = headGeometry(radius, thickness);

    while (headL.children.length) headL.remove(headL.children[0]);
    while (headR.children.length) headR.remove(headR.children[0]);

    const meshL = new THREE.Mesh(geo, headMat);
    const meshR = new THREE.Mesh(geo, headMat);
    headL.add(meshL);
    headR.add(meshR);

    const headX = HANDLE_HALF + COLLAR_GAP + collarThick + thickness / 2;
    headL.position.x = -headX;
    headR.position.x = headX;

    for (const g of collarGeos) g.dispose();
    collarGeos.length = 0;
    const cGeo = new THREE.CylinderGeometry(
      collarRadius,
      collarRadius,
      collarThick,
      20,
    );
    cGeo.rotateZ(Math.PI / 2);
    collarGeos.push(cGeo);
    collarL.geometry = cGeo;
    collarR.geometry = cGeo;
    const collarX = HANDLE_HALF + COLLAR_GAP + collarThick / 2;
    collarL.position.x = -collarX;
    collarR.position.x = collarX;
  };

  const nodes: Record<string, THREE.Object3D> = {
    root,
    handle,
    headLeft: headL,
    headRight: headR,
    collarLeft: collarL,
    collarRight: collarR,
  };

  const runtime: DumbbellRuntime = {
    nodes,
    setWeight,
    dispose: () => {
      for (const geo of owned) geo.dispose();
      for (const geo of collarGeos) geo.dispose();
    },
  };

  root.userData.sculptRuntime = runtime;
  return root;
}
