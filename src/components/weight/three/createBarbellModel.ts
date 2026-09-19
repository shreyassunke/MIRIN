import * as THREE from "three";
import { PLATE_SIZES, plateColor, type Unit } from "../../../lib/units";
import {
  collarMaterial,
  hubMaterial,
  knurlMaterial,
  plateMaterial,
  steelMaterial,
} from "./materials";

export const SHAFT_RADIUS = 0.022;
export const SLEEVE_RADIUS = 0.034;
export const COLLAR_X = 0.43;
export const COLLAR_RADIUS = 0.048;
export const COLLAR_THICK = 0.018;
export const SLEEVE_END = 1.08;
export const SLEEVE_INSET = 0.01;
export const PLATE_GAP = 0.008;
export const SETTLE_MS = 160;

const plateGeoCache = new Map<string, THREE.BufferGeometry>();
const hubGeoCache = new Map<string, THREE.BufferGeometry>();

/** Same growth curve as the SVG `plateDims`, mapped into world units. */
export function plateWorldDims(value: number, unit: Unit) {
  const max = PLATE_SIZES[unit][0];
  const t = Math.max(0, Math.min(1, value / max));
  return {
    radius: 0.13 + 0.2 * Math.pow(t, 0.75),
    thickness: 0.02 + 0.034 * t,
  };
}

function plateGeometry(radius: number, thickness: number): THREE.BufferGeometry {
  const key = `${radius.toFixed(4)}:${thickness.toFixed(4)}`;
  const hit = plateGeoCache.get(key);
  if (hit) return hit;
  const half = thickness / 2;
  const inner = radius * 0.18;
  const points = [
    new THREE.Vector2(inner, -half),
    new THREE.Vector2(radius * 0.94, -half),
    new THREE.Vector2(radius, -half * 0.42),
    new THREE.Vector2(radius, half * 0.42),
    new THREE.Vector2(radius * 0.94, half),
    new THREE.Vector2(inner, half),
  ];
  const geo = new THREE.LatheGeometry(points, 28);
  geo.rotateZ(Math.PI / 2);
  plateGeoCache.set(key, geo);
  return geo;
}

function hubGeometry(radius: number, thickness: number): THREE.BufferGeometry {
  const key = `${radius.toFixed(4)}:${thickness.toFixed(4)}`;
  const hit = hubGeoCache.get(key);
  if (hit) return hit;
  const geo = new THREE.CylinderGeometry(
    radius * 0.22,
    radius * 0.22,
    thickness * 1.04,
    16,
  );
  geo.rotateZ(Math.PI / 2);
  hubGeoCache.set(key, geo);
  return geo;
}

function easeOutExpo(t: number) {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export type PlateHit = {
  index: number;
  mesh: THREE.Object3D;
};

export type BarbellRuntime = {
  nodes: Record<string, THREE.Object3D>;
  sockets: { plateLeft: THREE.Group; plateRight: THREE.Group };
  plateMeshes: THREE.Object3D[];
  setPlates: (plates: number[], unit: Unit, animate: boolean) => void;
  tick: (now: number) => boolean;
  dispose: () => void;
};

type Slot = {
  mesh: THREE.Object3D;
  restX: number;
  startX: number;
  born: number;
  index: number;
};

export function createBarbellModel(): THREE.Group {
  const root = new THREE.Group();
  root.name = "MIRIN Loaded Barbell";

  const steel = steelMaterial();
  const owned: THREE.BufferGeometry[] = [];

  const shaftLen = COLLAR_X * 2 + 0.02;
  const shaftGeo = new THREE.CylinderGeometry(
    SHAFT_RADIUS,
    SHAFT_RADIUS,
    shaftLen,
    20,
  );
  shaftGeo.rotateZ(Math.PI / 2);
  owned.push(shaftGeo);
  const shaft = new THREE.Mesh(shaftGeo, steel);
  shaft.name = "shaft";
  root.add(shaft);

  const knurlGeo = new THREE.CylinderGeometry(
    SHAFT_RADIUS * 1.08,
    SHAFT_RADIUS * 1.08,
    0.16,
    16,
  );
  knurlGeo.rotateZ(Math.PI / 2);
  owned.push(knurlGeo);
  const knurlMat = knurlMaterial();
  const knurlL = new THREE.Mesh(knurlGeo, knurlMat);
  knurlL.position.x = -0.18;
  knurlL.name = "knurlLeft";
  root.add(knurlL);
  const knurlR = knurlL.clone();
  knurlR.position.x = 0.18;
  knurlR.name = "knurlRight";
  root.add(knurlR);

  const sleeveLen = SLEEVE_END - COLLAR_X;
  const sleeveGeo = new THREE.CylinderGeometry(
    SLEEVE_RADIUS,
    SLEEVE_RADIUS,
    sleeveLen,
    20,
  );
  sleeveGeo.rotateZ(Math.PI / 2);
  owned.push(sleeveGeo);
  const sleeveL = new THREE.Mesh(sleeveGeo, steel);
  sleeveL.position.x = -(COLLAR_X + sleeveLen / 2);
  sleeveL.name = "sleeveLeft";
  root.add(sleeveL);
  const sleeveR = sleeveL.clone();
  sleeveR.position.x = COLLAR_X + sleeveLen / 2;
  sleeveR.name = "sleeveRight";
  root.add(sleeveR);

  const collarGeo = new THREE.CylinderGeometry(
    COLLAR_RADIUS,
    COLLAR_RADIUS,
    COLLAR_THICK,
    24,
  );
  collarGeo.rotateZ(Math.PI / 2);
  owned.push(collarGeo);
  const collarMat = collarMaterial();
  const collarL = new THREE.Mesh(collarGeo, collarMat);
  collarL.position.x = -COLLAR_X;
  collarL.name = "collarLeft";
  root.add(collarL);
  const collarR = collarL.clone();
  collarR.position.x = COLLAR_X;
  collarR.name = "collarRight";
  root.add(collarR);

  const socketL = new THREE.Group();
  socketL.name = "socketPlateLeft";
  root.add(socketL);
  const socketR = new THREE.Group();
  socketR.name = "socketPlateRight";
  root.add(socketR);

  const plateMeshes: THREE.Object3D[] = [];
  const slots: Slot[] = [];
  const hubMat = hubMaterial();

  const setPlates = (plates: number[], unit: Unit, animate: boolean) => {
    while (socketL.children.length) socketL.remove(socketL.children[0]);
    while (socketR.children.length) socketR.remove(socketR.children[0]);
    plateMeshes.length = 0;
    slots.length = 0;

    let cursor = SLEEVE_INSET;
    const now = performance.now();
    plates.forEach((value, index) => {
      const { radius, thickness } = plateWorldDims(value, unit);
      const rest = cursor + thickness / 2;
      const start = animate ? rest + 0.08 + index * 0.012 : rest;
      const color = plateColor(unit, value);
      const geo = plateGeometry(radius, thickness);
      const mat = plateMaterial(color);
      const hubGeo = hubGeometry(radius, thickness);

      const left = new THREE.Group();
      const leftPlate = new THREE.Mesh(geo, mat);
      const leftHub = new THREE.Mesh(hubGeo, hubMat);
      left.add(leftPlate, leftHub);
      left.position.x = -COLLAR_X - start;
      left.userData.plateIndex = index;
      left.name = `plateL-${index}`;
      socketL.add(left);

      const right = new THREE.Group();
      const rightPlate = new THREE.Mesh(geo, mat);
      const rightHub = new THREE.Mesh(hubGeo, hubMat);
      right.add(rightPlate, rightHub);
      right.position.x = COLLAR_X + start;
      right.userData.plateIndex = index;
      right.name = `plateR-${index}`;
      socketR.add(right);

      plateMeshes.push(left, right);
      slots.push(
        {
          mesh: left,
          restX: -COLLAR_X - rest,
          startX: -COLLAR_X - start,
          born: now,
          index,
        },
        {
          mesh: right,
          restX: COLLAR_X + rest,
          startX: COLLAR_X + start,
          born: now,
          index,
        },
      );
      cursor += thickness + PLATE_GAP;
    });
  };

  const tick = (now: number) => {
    let dirty = false;
    for (const slot of slots) {
      const t = easeOutExpo(Math.min(1, (now - slot.born) / SETTLE_MS));
      const x = slot.startX + (slot.restX - slot.startX) * t;
      if (Math.abs(slot.mesh.position.x - x) > 1e-5) {
        slot.mesh.position.x = x;
        dirty = true;
      }
    }
    return dirty;
  };

  const nodes: Record<string, THREE.Object3D> = {
    root,
    shaft,
    sleeveLeft: sleeveL,
    sleeveRight: sleeveR,
    collarLeft: collarL,
    collarRight: collarR,
    knurlLeft: knurlL,
    knurlRight: knurlR,
    socketPlateLeft: socketL,
    socketPlateRight: socketR,
  };

  const runtime: BarbellRuntime = {
    nodes,
    sockets: { plateLeft: socketL, plateRight: socketR },
    plateMeshes,
    setPlates,
    tick,
    dispose: () => {
      for (const geo of owned) geo.dispose();
    },
  };

  root.userData.sculptRuntime = runtime;
  return root;
}
