import * as THREE from "three";
import { plateColor, type Unit } from "../../../lib/units";
import {
  addContactShadow,
  knurlMaterial,
  plateMaterial,
  steelMaterial,
} from "./materials";
import {
  alongX,
  BAR_LEN,
  COLLAR_X,
  PLATE_GAP,
  plateWorldDims,
  SHAFT_R,
  SLEEVE_LEN,
  SLEEVE_R,
} from "./scale";
import { addPlateFaces } from "./stamp";

export const SETTLE_MS = 160;
const SEG = 64;
const plateGeoCache = new Map<string, THREE.BufferGeometry>();

function bumperGeometry(radius: number, thickness: number, hole: number) {
  const key = `${radius.toFixed(3)}:${thickness.toFixed(3)}:${hole.toFixed(3)}`;
  const hit = plateGeoCache.get(key);
  if (hit) return hit;
  const half = thickness / 2;
  const bevel = Math.min(0.18, half * 0.18, radius * 0.02);
  const points: THREE.Vector2[] = [];
  const push = (x: number, y: number) => points.push(new THREE.Vector2(x, y));

  push(hole, -half);
  push(hole, half);
  push(radius - bevel, half);
  push(radius, half - bevel);
  push(radius, -half + bevel);
  push(radius - bevel, -half);

  const geo = alongX(new THREE.LatheGeometry(points, SEG));
  geo.userData.shared = true;
  plateGeoCache.set(key, geo);
  return geo;
}

function easeOutExpo(t: number) {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

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
};

function disposePlate(group: THREE.Object3D) {
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    if (!child.geometry.userData.shared) child.geometry.dispose();
    const mat = child.material;
    if (mat && !Array.isArray(mat) && mat.transparent && !mat.name) mat.dispose();
  });
}

export function createBarbellModel(): THREE.Group {
  const root = new THREE.Group();
  root.name = "MIRIN Loaded Barbell";

  const chrome = steelMaterial();
  const knurlMat = knurlMaterial();
  const owned: THREE.BufferGeometry[] = [];

  const shaftLen = COLLAR_X * 2;
  const shaftGeo = alongX(
    new THREE.CylinderGeometry(SHAFT_R, SHAFT_R, shaftLen, 48),
  );
  owned.push(shaftGeo);
  const shaft = new THREE.Mesh(shaftGeo, chrome);
  shaft.name = "shaft";
  root.add(shaft);

  const knurlLen = 22;
  for (const x of [-28, 0, 28]) {
    const geo = alongX(
      new THREE.CylinderGeometry(SHAFT_R * 1.04, SHAFT_R * 1.04, knurlLen, 48),
    );
    owned.push(geo);
    const band = new THREE.Mesh(geo, knurlMat);
    band.position.x = x;
    band.name = `knurl-${x}`;
    root.add(band);
  }

  const sleeveGeo = alongX(
    new THREE.CylinderGeometry(SLEEVE_R, SLEEVE_R, SLEEVE_LEN, 48),
  );
  owned.push(sleeveGeo);
  const sleeveL = new THREE.Mesh(sleeveGeo, chrome);
  sleeveL.position.x = -(COLLAR_X + SLEEVE_LEN / 2);
  sleeveL.name = "sleeveLeft";
  root.add(sleeveL);
  const sleeveR = sleeveL.clone();
  sleeveR.position.x = COLLAR_X + SLEEVE_LEN / 2;
  sleeveR.name = "sleeveRight";
  root.add(sleeveR);

  const capGeo = alongX(
    new THREE.CylinderGeometry(SLEEVE_R * 1.05, SLEEVE_R * 0.92, 1.2, 32),
  );
  owned.push(capGeo);
  const capL = new THREE.Mesh(capGeo, chrome);
  capL.position.x = -BAR_LEN / 2;
  capL.name = "sleeveCapLeft";
  root.add(capL);
  const capR = capL.clone();
  capR.position.x = BAR_LEN / 2;
  capR.name = "sleeveCapRight";
  root.add(capR);

  const socketL = new THREE.Group();
  socketL.name = "socketPlateLeft";
  root.add(socketL);
  const socketR = new THREE.Group();
  socketR.name = "socketPlateRight";
  root.add(socketR);

  const shadow = addContactShadow(root, 1, 1, -24);

  const plateMeshes: THREE.Object3D[] = [];
  const slots: Slot[] = [];

  const setPlates = (plates: number[], unit: Unit, animate: boolean) => {
    while (socketL.children.length) {
      const child = socketL.children[0];
      socketL.remove(child);
      disposePlate(child);
    }
    while (socketR.children.length) {
      const child = socketR.children[0];
      socketR.remove(child);
      disposePlate(child);
    }
    plateMeshes.length = 0;
    slots.length = 0;

    const shoulder = COLLAR_X;
    let cursor = PLATE_GAP;
    const now = performance.now();
    let maxR = 8;
    plates.forEach((value, index) => {
      const { radius, thickness, hole } = plateWorldDims(value, unit);
      maxR = Math.max(maxR, radius);
      const rest = cursor + thickness / 2;
      const start = animate ? rest + 8 + index * 1.2 : rest;
      const hex = plateColor(unit, value);
      const geo = bumperGeometry(radius, thickness, hole);
      const mat = plateMaterial(hex);

      const left = new THREE.Group();
      left.add(new THREE.Mesh(geo, mat));
      addPlateFaces(left, value, hex, radius, thickness / 2 - 0.04);
      left.position.x = -(shoulder + start);
      left.userData.plateIndex = index;
      left.name = `plateL-${index}`;
      socketL.add(left);

      const right = new THREE.Group();
      right.add(new THREE.Mesh(geo, mat));
      addPlateFaces(right, value, hex, radius, thickness / 2 - 0.04);
      right.position.x = shoulder + start;
      right.userData.plateIndex = index;
      right.name = `plateR-${index}`;
      socketR.add(right);

      plateMeshes.push(left, right);
      slots.push(
        {
          mesh: left,
          restX: -(shoulder + rest),
          startX: -(shoulder + start),
          born: now,
        },
        {
          mesh: right,
          restX: shoulder + rest,
          startX: shoulder + start,
          born: now,
        },
      );
      cursor += thickness + PLATE_GAP;
    });

    shadow.scale.set(BAR_LEN * 0.55, 1, maxR * 1.1);
    shadow.position.y = -maxR * 0.98;
  };

  const tick = (now: number) => {
    let dirty = false;
    for (const slot of slots) {
      const t = easeOutExpo(Math.min(1, (now - slot.born) / SETTLE_MS));
      const x = slot.startX + (slot.restX - slot.startX) * t;
      if (Math.abs(slot.mesh.position.x - x) > 1e-4) {
        slot.mesh.position.x = x;
        dirty = true;
      }
    }
    return dirty;
  };

  const runtime: BarbellRuntime = {
    nodes: {
      root,
      shaft,
      sleeveLeft: sleeveL,
      sleeveRight: sleeveR,
      socketPlateLeft: socketL,
      socketPlateRight: socketR,
    },
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
