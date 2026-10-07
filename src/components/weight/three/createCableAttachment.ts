import * as THREE from "three";
import type { CableAttachmentId } from "../../../lib/cableAttachment";
import { CABLE_ATTACHMENTS } from "../../../lib/cableAttachment";
import { addContactShadow, gripMaterial, headMaterial, polishMaterial } from "./materials";
import { alongX } from "./scale";

/**
 * Procedural cable clips. Code only — no mesh file.
 *
 * Built from the reference photo (chrome, ribbed black grips, vertical
 * eyelets, braided rope with solid balls) and published sizes:
 * straight bar ~45 cm × Ø25 mm shaft, molded grips ~Ø32 mm;
 * close-grip row handle ~17.5 × 12 cm; rope ~69 cm shown in its resting U;
 * stirrup ~14 × 10 cm. Swivel tooth counts and the hidden side of each
 * knuckle are approximate; one photo cannot show them.
 */

const RADIAL = 28;
const chromeMat = () => polishMaterial();
const gripMat = () => gripMaterial();
const rubberMat = () => headMaterial();

type Built = {
  id: CableAttachmentId;
  group: THREE.Group;
};

export type CableAttachmentSet = {
  root: THREE.Group;
  show: (id: CableAttachmentId) => void;
  dispose: () => void;
};

export function createCableAttachmentSet(): CableAttachmentSet {
  const owned: THREE.BufferGeometry[] = [];
  const root = new THREE.Group();
  root.name = "MIRIN Cable attachments";
  const built = CABLE_ATTACHMENTS.map((item) => {
    const group = build(item.id, owned);
    group.name = item.id;
    group.visible = false;
    root.add(group);
    return { id: item.id, group } satisfies Built;
  });

  return {
    root,
    show(id) {
      for (const item of built) item.group.visible = item.id === id;
    },
    dispose() {
      for (const geo of owned) geo.dispose();
      owned.length = 0;
    },
  };
}

function build(id: CableAttachmentId, owned: THREE.BufferGeometry[]) {
  switch (id) {
    case "straight":
      return straightBar(owned);
    case "ez":
      return ezBar(owned);
    case "close":
      return closeGrip(owned);
    case "rope":
      return rope(owned);
    case "stirrup":
      return stirrup(owned);
  }
}

function own<T extends THREE.BufferGeometry>(owned: THREE.BufferGeometry[], geo: T) {
  owned.push(geo);
  return geo;
}

function add(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  position?: THREE.Vector3,
  quaternion?: THREE.Quaternion,
) {
  const mesh = new THREE.Mesh(geo, mat);
  if (position) mesh.position.copy(position);
  if (quaternion) mesh.quaternion.copy(quaternion);
  parent.add(mesh);
  return mesh;
}

function shaftGeo(owned: THREE.BufferGeometry[], radius: number, length: number) {
  return own(owned, alongX(new THREE.CylinderGeometry(radius, radius, length, RADIAL)));
}

/** Cylinder along X. Ribs come from the grip material, not a vertex wave. */
function gripGeo(owned: THREE.BufferGeometry[], radius: number, length: number) {
  return own(owned, alongX(new THREE.CylinderGeometry(radius, radius, length, RADIAL, 1)));
}

function rod(
  parent: THREE.Object3D,
  owned: THREE.BufferGeometry[],
  a: THREE.Vector3,
  b: THREE.Vector3,
  radius: number,
  mat: THREE.Material,
  grip = false,
) {
  const dir = b.clone().sub(a);
  const length = dir.length();
  if (length < 0.05) return;
  const geo = grip ? gripGeo(owned, radius, length) : shaftGeo(owned, radius, length);
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(1, 0, 0),
    dir.multiplyScalar(1 / length),
  );
  add(parent, geo, mat, a.clone().add(b).multiplyScalar(0.5), q);
}

function joint(
  parent: THREE.Object3D,
  owned: THREE.BufferGeometry[],
  at: THREE.Vector3,
  radius: number,
) {
  add(
    parent,
    own(owned, new THREE.SphereGeometry(radius, 16, 12)),
    chromeMat(),
    at,
  );
}

/** Horizontal ring. The hole is vertical so the elevated camera can see it. */
function eye(
  parent: THREE.Object3D,
  owned: THREE.BufferGeometry[],
  center: THREE.Vector3,
  outer: number,
  hole: number,
) {
  const thick = 0.42;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
  const path = new THREE.Path();
  path.absarc(0, 0, hole, 0, Math.PI * 2, true);
  shape.holes.push(path);
  const geo = own(
    owned,
    new THREE.ExtrudeGeometry(shape, {
      depth: thick,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 2,
      curveSegments: 28,
    }),
  );
  geo.translate(0, 0, -thick / 2);
  geo.rotateX(Math.PI / 2);
  add(parent, geo, chromeMat(), center);
}

function knuckle(
  parent: THREE.Object3D,
  owned: THREE.BufferGeometry[],
  x: number,
) {
  const geo = own(owned, new THREE.TorusGeometry(1.42, 0.28, 10, 22));
  geo.rotateY(Math.PI / 2);
  add(parent, geo, chromeMat(), new THREE.Vector3(x, 0, 0));
}

function shadow(parent: THREE.Object3D, width: number, depth: number, y: number) {
  addContactShadow(parent, width, depth, y);
}

function straightBar(owned: THREE.BufferGeometry[]) {
  const g = new THREE.Group();
  const chrome = chromeMat();
  const rubber = gripMat();
  const shaftR = 1.15;
  const gripR = 1.6;
  add(g, shaftGeo(owned, shaftR, 38), chrome);
  for (const sign of [-1, 1]) {
    add(g, gripGeo(owned, gripR, 12), rubber, new THREE.Vector3(sign * 8.4, 0, 0));
    add(g, shaftGeo(owned, 1.85, 0.55), chrome, new THREE.Vector3(sign * 2.2, 0, 0));
    add(g, shaftGeo(owned, 1.85, 0.55), chrome, new THREE.Vector3(sign * 14.6, 0, 0));
    add(g, shaftGeo(owned, 1.32, 4.4), chrome, new THREE.Vector3(sign * 17.2, 0, 0));
    knuckle(g, owned, sign * 15.4);
    knuckle(g, owned, sign * 19.2);
    eye(g, owned, new THREE.Vector3(sign * 21.7, 0, 0), 2.05, 0.82);
  }
  shadow(g, 48, 8, -1.85);
  return g;
}

function ezBar(owned: THREE.BufferGeometry[]) {
  const g = new THREE.Group();
  const chrome = chromeMat();
  const rubber = gripMat();
  // Shallow W: outer ends drop to the eyelets, grips slope down inward,
  // and the center rises again. A single valley reads as a V-bar.
  const pts = [
    new THREE.Vector3(-20, -1.15, 0),
    new THREE.Vector3(-16.6, 0.15, 0),
    new THREE.Vector3(-13.8, 1.85, 0),
    new THREE.Vector3(-5.2, -0.85, 0),
    new THREE.Vector3(-2.1, 0.85, 0),
    new THREE.Vector3(0, 1.45, 0),
    new THREE.Vector3(2.1, 0.85, 0),
    new THREE.Vector3(5.2, -0.85, 0),
    new THREE.Vector3(13.8, 1.85, 0),
    new THREE.Vector3(16.6, 0.15, 0),
    new THREE.Vector3(20, -1.15, 0),
  ];
  const grip = new Set([2, 7]);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    rod(g, owned, a, b, grip.has(i) ? 1.58 : 1.15, grip.has(i) ? rubber : chrome, grip.has(i));
    if (i > 0 && i < pts.length - 1) joint(g, owned, a, grip.has(i) || grip.has(i - 1) ? 1.2 : 1.15);
  }
  for (const end of [pts[0], pts[pts.length - 1]]) {
    const sign = Math.sign(end.x) || 1;
    const neck = end.clone().add(new THREE.Vector3(sign * 1.6, 0.15, 0));
    rod(g, owned, end, neck, 1.15, chrome);
    eye(g, owned, neck.clone().add(new THREE.Vector3(sign * 2.05, 0, 0)), 1.9, 0.78);
    joint(g, owned, neck, 0.62);
  }
  shadow(g, 46, 8, -4.5);
  return g;
}

function roundedFrame(
  parent: THREE.Object3D,
  owned: THREE.BufferGeometry[],
  width: number,
  height: number,
  tube: number,
  skipBottom = false,
) {
  const chrome = chromeMat();
  const bend = Math.min(tube * 2.6, width / 5, height / 5);
  const hw = width / 2;
  const hh = height / 2;
  const ix = hw - bend;
  const iy = hh - bend;
  const yBottom = skipBottom ? -hh : -iy;
  rod(
    parent,
    owned,
    new THREE.Vector3(-ix, hh, 0),
    new THREE.Vector3(ix, hh, 0),
    tube,
    chrome,
  );
  if (!skipBottom) {
    rod(
      parent,
      owned,
      new THREE.Vector3(-ix, -hh, 0),
      new THREE.Vector3(ix, -hh, 0),
      tube,
      chrome,
    );
  }
  for (const x of [-hw, hw]) {
    rod(
      parent,
      owned,
      new THREE.Vector3(x, yBottom, 0),
      new THREE.Vector3(x, iy, 0),
      tube,
      chrome,
    );
  }
  const corners: [number, number, number][] = [
    [ix, iy, 0],
    [-ix, iy, Math.PI / 2],
    [-ix, -iy, Math.PI],
    [ix, -iy, -Math.PI / 2],
  ];
  for (const [x, y, rot] of corners) {
    if (skipBottom && y < 0) continue;
    const geo = own(owned, new THREE.TorusGeometry(bend, tube, 8, 14, Math.PI / 2));
    geo.rotateZ(rot);
    add(parent, geo, chrome, new THREE.Vector3(x, y, 0));
  }
}

function closeGrip(owned: THREE.BufferGeometry[]) {
  const g = new THREE.Group();
  const chrome = chromeMat();
  const rubber = gripMat();
  const tube = 0.62;
  roundedFrame(g, owned, 16.4, 13.2, tube);
  for (const y of [2.35, -2.35]) {
    add(g, gripGeo(owned, 1.18, 13.4), rubber, new THREE.Vector3(0, y, 0));
    for (const x of [-7.15, 7.15]) {
      add(g, shaftGeo(owned, 1.42, 0.42), chrome, new THREE.Vector3(x, y, 0));
    }
  }
  const stemTop = new THREE.Vector3(0, 8.2, 0);
  rod(g, owned, new THREE.Vector3(0, 6.6, 0), stemTop, 0.5, chrome);
  eye(g, owned, new THREE.Vector3(0, 9.15, 0), 1.7, 0.68);
  joint(g, owned, stemTop, 0.46);
  shadow(g, 20, 8, -7.6);
  return g;
}

function braidTube(owned: THREE.BufferGeometry[], curve: THREE.CatmullRomCurve3) {
  const geo = own(owned, new THREE.TubeGeometry(curve, 80, 1.15, 16, false));
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const normal = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const along = uv.getX(i);
    const around = uv.getY(i);
    const strand = Math.cos((around * 3 + along * 22) * Math.PI * 2);
    const amp = 0.09 * (0.35 + 0.65 * Math.max(0, strand));
    pos.setXYZ(
      i,
      pos.getX(i) + normal.getX(i) * amp,
      pos.getY(i) + normal.getY(i) * amp,
      pos.getZ(i) + normal.getZ(i) * amp,
    );
  }
  geo.computeVertexNormals();
  return geo;
}

function rope(owned: THREE.BufferGeometry[]) {
  const g = new THREE.Group();
  const chrome = chromeMat();
  const rubber = rubberMat();
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-9.2, -6.2, 0),
    new THREE.Vector3(-7.4, 0.4, 0.4),
    new THREE.Vector3(-3.6, 5.6, 0.2),
    new THREE.Vector3(0, 7.2, 0),
    new THREE.Vector3(3.6, 5.6, -0.2),
    new THREE.Vector3(7.4, 0.4, -0.4),
    new THREE.Vector3(9.2, -6.2, 0),
  ]);
  add(g, braidTube(owned, curve), rubber);
  for (const sign of [-1, 1]) {
    const ball = own(owned, new THREE.SphereGeometry(2.45, 28, 20));
    add(g, ball, rubber, new THREE.Vector3(sign * 9.6, -7.5, 0));
    const collar = own(owned, new THREE.TorusGeometry(0.85, 0.22, 8, 16));
    collar.rotateX(Math.PI / 2.4);
    add(g, collar, rubber, new THREE.Vector3(sign * 8.7, -5.7, 0));
  }
  const hookStem = new THREE.Vector3(0, 8.5, 0);
  rod(g, owned, new THREE.Vector3(0, 7.2, 0), hookStem, 0.48, chrome);
  const hook = own(owned, new THREE.TorusGeometry(1.65, 0.32, 12, 28, Math.PI * 1.65));
  hook.rotateX(Math.PI / 2);
  add(g, hook, chrome, new THREE.Vector3(0, 9.35, 0));
  joint(g, owned, hookStem, 0.42);
  shadow(g, 26, 10, -10.2);
  return g;
}

function stirrup(owned: THREE.BufferGeometry[]) {
  const g = new THREE.Group();
  const chrome = chromeMat();
  const rubber = gripMat();
  const tube = 0.58;
  roundedFrame(g, owned, 13.2, 9.4, tube, true);
  const gripY = -4.7;
  add(g, gripGeo(owned, 1.48, 9.2), rubber, new THREE.Vector3(0, gripY, 0));
  for (const sign of [-1, 1]) {
    const collarX = sign * 5.05;
    add(g, shaftGeo(owned, 1.64, 0.46), chrome, new THREE.Vector3(collarX, gripY, 0));
    rod(
      g,
      owned,
      new THREE.Vector3(sign * 6.6, gripY, 0),
      new THREE.Vector3(collarX, gripY, 0),
      tube,
      chrome,
    );
    joint(g, owned, new THREE.Vector3(sign * 6.6, gripY, 0), tube);
  }
  const stem = new THREE.Vector3(0, 6.15, 0);
  rod(g, owned, new THREE.Vector3(0, 4.7, 0), stem, 0.5, chrome);
  const swivel = own(owned, new THREE.TorusGeometry(1.2, 0.28, 12, 22));
  swivel.rotateX(Math.PI / 2);
  add(g, swivel, chrome, new THREE.Vector3(0, 6.85, 0));
  joint(g, owned, stem, 0.42);
  shadow(g, 16, 7, -6.5);
  return g;
}
