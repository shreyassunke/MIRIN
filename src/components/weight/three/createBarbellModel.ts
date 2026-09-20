import * as THREE from "three";
import type { Unit } from "../../../lib/units";
import {
  addContactShadow,
  collarMaterial,
  knurlMaterial,
  steelMaterial,
} from "./materials";
import {
  alongX,
  BAR_LEN,
  COLLAR_R,
  COLLAR_T,
  COLLAR_X,
  PLATE_GAP,
  plateWorldDims,
  SHAFT_R,
  SLEEVE_LEN,
  SLEEVE_R,
  SLEEVE_TIP_MARGIN,
} from "./scale";
import { createPlate } from "./createPlate";

export const SETTLE_MS = 160;

/**
 * Clamped, because the rAF timestamp is the frame's start time and can
 * predate the `performance.now()` taken when the slot was born. A negative
 * t turns 2^(-10t) into an astronomical number, which flings the plates off
 * to ~1e18 and permanently poisons the camera fit that follows.
 */
function easeOutExpo(t: number) {
  if (t <= 0) return 0;
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

/**
 * One slot drives both stacks. There is no per-side position anywhere in
 * this file: the left half is the right half under a scale.x = -1 wrapper,
 * so the two can never drift apart.
 */
type Slot = {
  meshes: THREE.Object3D[];
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
  const collarMat = collarMaterial();
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
  const knurlGeo = alongX(
    new THREE.CylinderGeometry(SHAFT_R * 1.04, SHAFT_R * 1.04, knurlLen, 48),
  );
  owned.push(knurlGeo);
  // The centre band is built as two mirrored halves rather than one mesh
  // straddling x = 0: the knurl's diagonal cross-hatch is not symmetric
  // about its own midpoint, so a single mesh would break the flip test.
  const halfKnurlGeo = alongX(
    new THREE.CylinderGeometry(SHAFT_R * 1.04, SHAFT_R * 1.04, knurlLen / 2, 48),
  );
  owned.push(halfKnurlGeo);

  const sleeveGeo = alongX(
    new THREE.CylinderGeometry(SLEEVE_R, SLEEVE_R, SLEEVE_LEN, 48),
  );
  owned.push(sleeveGeo);
  const capGeo = alongX(
    new THREE.CylinderGeometry(SLEEVE_R * 1.05, SLEEVE_R * 0.92, 1.2, 32),
  );
  owned.push(capGeo);
  const collarGeo = alongX(
    new THREE.CylinderGeometry(COLLAR_R, COLLAR_R, COLLAR_T, 48),
  );
  owned.push(collarGeo);

  /** Everything outboard of centre, authored once at +x. */
  function buildSide() {
    const side = new THREE.Group();

    const centre = new THREE.Mesh(halfKnurlGeo, knurlMat);
    centre.position.x = knurlLen / 4;
    centre.name = "knurlCentreHalf";
    side.add(centre);

    const knurl = new THREE.Mesh(knurlGeo, knurlMat);
    knurl.position.x = 28;
    knurl.name = "knurlGrip";
    side.add(knurl);

    const collar = new THREE.Mesh(collarGeo, collarMat);
    collar.position.x = COLLAR_X;
    collar.name = "collar";
    side.add(collar);

    const sleeve = new THREE.Mesh(sleeveGeo, chrome);
    sleeve.position.x = COLLAR_X + SLEEVE_LEN / 2;
    sleeve.name = "sleeve";
    side.add(sleeve);

    const cap = new THREE.Mesh(capGeo, chrome);
    cap.position.x = BAR_LEN / 2;
    cap.name = "sleeveCap";
    side.add(cap);

    const socket = new THREE.Group();
    socket.name = "socketPlate";
    side.add(socket);

    return { side, socket };
  }

  const right = buildSide();
  right.side.name = "sideRight";
  root.add(right.side);

  const left = buildSide();
  left.side.name = "sideLeft";
  left.side.scale.x = -1;
  root.add(left.side);

  const sockets = [right.socket, left.socket];
  const shadow = addContactShadow(root, 1, 1, -24);

  const plateMeshes: THREE.Object3D[] = [];
  const slots: Slot[] = [];

  const setPlates = (plates: number[], unit: Unit, animate: boolean) => {
    for (const socket of sockets) {
      while (socket.children.length) {
        const child = socket.children[0];
        socket.remove(child);
        disposePlate(child);
      }
    }
    plateMeshes.length = 0;
    slots.length = 0;

    // Plates butt against the collar's outer face and grow toward the tip.
    const shoulder = COLLAR_X + COLLAR_T / 2;
    const dims = plates.map((value) => plateWorldDims(value, unit));

    // A very deep stack would otherwise run off the end of the sleeve. Thin
    // the discs to fit rather than let them float past the tip; the squeeze
    // is identical on both sides, so the pose stays symmetric.
    const needed =
      dims.reduce((sum, d) => sum + d.thickness, 0) +
      (dims.length + 1) * PLATE_GAP;
    const room = BAR_LEN / 2 - shoulder - SLEEVE_TIP_MARGIN;
    const squeeze = needed > room ? room / needed : 1;

    let cursor = PLATE_GAP * squeeze;
    const now = performance.now();
    let maxR = 8;
    plates.forEach((value, index) => {
      const meshes = sockets.map((socket) => {
        const plate = createPlate(value, unit);
        plate.scale.x = squeeze;
        plate.userData.plateIndex = index;
        plate.name = `plate-${index}`;
        socket.add(plate);
        return plate;
      });
      maxR = Math.max(maxR, dims[index].radius);
      const thickness = dims[index].thickness * squeeze;

      const restX = shoulder + cursor + thickness / 2;
      // Capped at the sleeve tip: the camera is fitted to the bar's bounding
      // box, so a fly-in that overshoots the tip would widen the framing for
      // the whole life of that stack.
      const restY = restX + 8 + index * 1.2;
      const startX = animate
        ? Math.min(restY, BAR_LEN / 2 - thickness / 2)
        : restX;
      for (const mesh of meshes) mesh.position.x = startX;

      plateMeshes.push(...meshes);
      slots.push({ meshes, restX, startX, born: now });
      cursor += thickness + PLATE_GAP * squeeze;
    });

    shadow.scale.set(BAR_LEN * 0.55, 1, maxR * 1.1);
    shadow.position.y = -maxR * 0.98;
  };

  // Report "still running" from the clock, not from whether a position
  // moved. On the first frame the rAF timestamp can predate `born`, so
  // nothing has moved yet — answering "not dirty" there ends the loop
  // before the animation starts and strands every plate at its fly-in
  // offset until some unrelated event happens to restart the loop.
  const tick = (now: number) => {
    let running = false;
    for (const slot of slots) {
      const t = easeOutExpo((now - slot.born) / SETTLE_MS);
      if (t < 1) running = true;
      const x = slot.startX + (slot.restX - slot.startX) * t;
      for (const mesh of slot.meshes) {
        if (Math.abs(mesh.position.x - x) > 1e-4) mesh.position.x = x;
      }
    }
    return running;
  };

  const runtime: BarbellRuntime = {
    nodes: {
      root,
      shaft,
      sideLeft: left.side,
      sideRight: right.side,
      socketPlateLeft: left.socket,
      socketPlateRight: right.socket,
    },
    sockets: { plateLeft: left.socket, plateRight: right.socket },
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
