import * as THREE from "three";
import type { Unit } from "../../../lib/units";
import {
  addContactShadow,
  collarMaterial,
  headMaterial,
  knurlMaterial,
  steelMaterial,
} from "./materials";
import {
  alongX,
  DB_COLLAR_R,
  DB_COLLAR_T,
  DB_HANDLE_LEN,
  DB_HANDLE_R,
  dumbbellHeadDims,
  dumbbellMaxHeadDims,
} from "./scale";

const SEG = 96;
const headGeoCache = new Map<string, THREE.BufferGeometry>();

/**
 * Thick urethane puck: flat faces, cylindrical sidewall, 4–5 mm chamfer.
 * Profile taken from the side-on gym reference (rounded-rect silhouette).
 */
function headGeometry(radius: number, thickness: number, chamfer: number) {
  const key = `${radius.toFixed(3)}:${thickness.toFixed(3)}:${chamfer.toFixed(3)}`;
  const hit = headGeoCache.get(key);
  if (hit) return hit;
  const half = thickness / 2;
  const ch = Math.min(chamfer * 1.15, half * 0.42, radius * 0.14);
  const points: THREE.Vector2[] = [];
  const push = (x: number, y: number) => points.push(new THREE.Vector2(x, y));

  push(DB_HANDLE_R * 1.02, -half);
  push(radius - ch, -half);
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    push(radius - ch + Math.sin(a) * ch, -half + ch - Math.cos(a) * ch);
  }
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    push(radius - (1 - Math.cos(a)) * ch, half - ch + Math.sin(a) * ch);
  }
  push(radius - ch, half);
  push(DB_HANDLE_R * 1.02, half);

  const geo = alongX(new THREE.LatheGeometry(points, SEG));
  geo.userData.shared = true;
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

  const chrome = steelMaterial("db-steel");
  const knurl = knurlMaterial();
  const rubber = headMaterial();
  const collarMat = collarMaterial();
  const owned: THREE.BufferGeometry[] = [];

  const knurlLen = DB_HANDLE_LEN - 0.4;
  const knurlGeo = alongX(
    new THREE.CylinderGeometry(DB_HANDLE_R, DB_HANDLE_R, knurlLen, SEG),
  );
  owned.push(knurlGeo);
  const handle = new THREE.Mesh(knurlGeo, knurl);
  handle.name = "handle";
  root.add(handle);

  const polishLen = (DB_HANDLE_LEN - knurlLen) / 2 + 0.15;
  const polishGeo = alongX(
    new THREE.CylinderGeometry(
      DB_HANDLE_R * 0.98,
      DB_HANDLE_R * 0.98,
      polishLen,
      48,
    ),
  );
  owned.push(polishGeo);
  const polishL = new THREE.Mesh(polishGeo, chrome);
  polishL.position.x = -(knurlLen / 2 + polishLen / 2 - 0.08);
  polishL.name = "polishLeft";
  root.add(polishL);
  const polishR = polishL.clone();
  polishR.position.x = knurlLen / 2 + polishLen / 2 - 0.08;
  polishR.name = "polishRight";
  root.add(polishR);

  const collarGeo = alongX(
    new THREE.CylinderGeometry(DB_COLLAR_R, DB_COLLAR_R * 1.04, DB_COLLAR_T, 48),
  );
  owned.push(collarGeo);
  const collarL = new THREE.Mesh(collarGeo, collarMat);
  collarL.position.x = -(DB_HANDLE_LEN / 2 + DB_COLLAR_T / 2);
  collarL.name = "collarLeft";
  root.add(collarL);
  const collarR = collarL.clone();
  collarR.position.x = DB_HANDLE_LEN / 2 + DB_COLLAR_T / 2;
  collarR.name = "collarRight";
  root.add(collarR);

  const headL = new THREE.Mesh();
  headL.material = rubber;
  headL.name = "headLeft";
  root.add(headL);
  const headR = new THREE.Mesh();
  headR.material = rubber;
  headR.name = "headRight";
  root.add(headR);

  const shadow = addContactShadow(root, 1, 1, -8);

  // Invisible envelope so the camera fits the heaviest dumbbell, not the
  // current one — otherwise every weight fills the frame the same way.
  const max = dumbbellMaxHeadDims();
  const maxHeadX = DB_HANDLE_LEN / 2 + DB_COLLAR_T + max.thickness / 2;
  const fitGeo = new THREE.BoxGeometry(
    (maxHeadX + max.thickness / 2) * 2,
    max.radius * 2,
    max.radius * 2,
  );
  owned.push(fitGeo);
  const fitBounds = new THREE.Mesh(fitGeo);
  fitBounds.visible = false;
  fitBounds.name = "fitBounds";
  root.add(fitBounds);

  const setWeight = (value: number, unit: Unit) => {
    const { radius, thickness, chamfer } = dumbbellHeadDims(value, unit);
    const geo = headGeometry(radius, thickness, chamfer);
    headL.geometry = geo;
    headR.geometry = geo;
    const headX = DB_HANDLE_LEN / 2 + DB_COLLAR_T + thickness / 2;
    headL.position.x = -headX;
    headR.position.x = headX;
    shadow.scale.set(headX + thickness / 2, 1, radius);
    shadow.position.y = -radius * 0.96;
  };

  const runtime: DumbbellRuntime = {
    nodes: {
      root,
      handle,
      headLeft: headL,
      headRight: headR,
      collarLeft: collarL,
      collarRight: collarR,
    },
    setWeight,
    dispose: () => {
      for (const geo of owned) geo.dispose();
    },
  };
  root.userData.sculptRuntime = runtime;
  return root;
}
