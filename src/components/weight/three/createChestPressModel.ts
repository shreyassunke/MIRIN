import * as THREE from "three";

/**
 * Plate-loaded converging chest press, built from the reference views.
 * Logos on the arms and plates are not copied. Arms, frame, and pads stay
 * in the grey and black palette.
 */
let bucket: THREE.BufferGeometry[] = [];

function geo<T extends THREE.BufferGeometry>(geometry: T): T {
  bucket.push(geometry);
  return geometry;
}

function beam(
  a: THREE.Vector3,
  b: THREE.Vector3,
  width: number,
  height: number,
  material: THREE.Material,
) {
  const dir = b.clone().sub(a);
  const length = dir.length();
  const mesh = new THREE.Mesh(geo(new THREE.BoxGeometry(width, height, length)), material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.normalize());
  return mesh;
}

function box(
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
  rotation?: [number, number, number],
) {
  const mesh = new THREE.Mesh(geo(new THREE.BoxGeometry(...size)), material);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  return mesh;
}

let materials: {
  frame: THREE.MeshStandardMaterial;
  arm: THREE.MeshStandardMaterial;
  pad: THREE.MeshStandardMaterial;
  plate: THREE.MeshStandardMaterial;
  chrome: THREE.MeshStandardMaterial;
} | null = null;

function padBump() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = "#5e5e5e";
  ctx.lineWidth = 1;
  for (let i = 0; i < 64; i += 4) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 64);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(64, i);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 10);
  return tex;
}

function mats() {
  if (materials) return materials;
  const bump = padBump();
  const pad = new THREE.MeshStandardMaterial({
    color: "#141414",
    metalness: 0.02,
    roughness: 0.9,
    bumpMap: bump ?? undefined,
    bumpScale: 0.015,
  });
  materials = {
    frame: new THREE.MeshStandardMaterial({
      color: "#3a3a3e",
      metalness: 0.48,
      roughness: 0.42,
      envMapIntensity: 1.05,
    }),
    arm: new THREE.MeshStandardMaterial({
      color: "#c4c4c8",
      metalness: 0.62,
      roughness: 0.4,
      envMapIntensity: 1.05,
    }),
    pad,
    plate: new THREE.MeshStandardMaterial({
      color: "#2e2e30",
      metalness: 0.72,
      roughness: 0.34,
      envMapIntensity: 1,
    }),
    chrome: new THREE.MeshStandardMaterial({
      color: "#d5d5d8",
      metalness: 0.92,
      roughness: 0.22,
      envMapIntensity: 1.15,
    }),
  };
  return materials;
}

function side(sign: number, parent: THREE.Group, m: ReturnType<typeof mats>) {
  const x = (n: number) => n * sign;
  const frame = m.frame;
  const add = (mesh: THREE.Mesh) => {
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    parent.add(mesh);
  };

  add(box([0.1, 0.1, 2.2], [x(1.05), 0.08, 0.05], frame));
  add(box([0.12, 2.05, 0.12], [x(1.05), 1.1, -0.92], frame));
  add(box([0.1, 0.85, 0.1], [x(1.05), 0.48, 0.82], frame));
  add(box([0.08, 0.08, 1.55], [x(1.05), 0.86, -0.05], frame));
  add(
    beam(
      new THREE.Vector3(x(1.05), 2.05, -0.92),
      new THREE.Vector3(x(0.98), 1.78, -0.08),
      0.1,
      0.1,
      frame,
    ),
  );
  add(
    beam(
      new THREE.Vector3(x(1.05), 0.86, 0.35),
      new THREE.Vector3(x(0.98), 1.55, -0.02),
      0.08,
      0.08,
      frame,
    ),
  );

  const pivot = new THREE.Group();
  pivot.name = sign > 0 ? "armPivotRight" : "armPivotLeft";
  pivot.position.set(x(0.98), 1.78, -0.08);
  parent.add(pivot);

  const axle = new THREE.Mesh(
    geo(new THREE.CylinderGeometry(0.07, 0.07, 0.22, 20)),
    m.chrome,
  );
  axle.rotation.z = Math.PI / 2;
  pivot.add(axle);

  const arm = new THREE.Group();
  arm.name = sign > 0 ? "pressArmRight" : "pressArmLeft";
  pivot.add(arm);

  const elbow = new THREE.Vector3(x(-0.22), -0.28, 0.42);
  const hand = new THREE.Vector3(x(-0.46), -0.62, 0.78);
  arm.add(beam(new THREE.Vector3(0, 0, 0), elbow, 0.2, 0.26, m.arm));
  arm.add(beam(elbow, hand, 0.18, 0.22, m.arm));
  arm.add(box([0.22, 0.24, 0.22], [elbow.x, elbow.y, elbow.z], m.arm));

  const grip = new THREE.Mesh(
    geo(new THREE.CylinderGeometry(0.032, 0.032, 0.34, 16)),
    m.chrome,
  );
  grip.rotation.z = Math.PI / 2;
  grip.position.set(x(-0.62), -0.7, 0.86);
  grip.name = sign > 0 ? "gripRight" : "gripLeft";
  arm.add(grip);

  const horn = new THREE.Mesh(
    geo(new THREE.CylinderGeometry(0.028, 0.028, 0.55, 16)),
    m.chrome,
  );
  horn.rotation.z = Math.PI / 2;
  horn.position.set(x(0.32), 0, 0);
  arm.add(horn);

  const plate = new THREE.Mesh(
    geo(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 48)),
    m.plate,
  );
  plate.rotation.z = Math.PI / 2;
  plate.position.set(x(0.42), 0, 0);
  plate.name = sign > 0 ? "plateRight" : "plateLeft";
  arm.add(plate);

  const hub = new THREE.Mesh(
    geo(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 20)),
    m.chrome,
  );
  hub.rotation.z = Math.PI / 2;
  hub.position.set(x(0.42), 0, 0);
  arm.add(hub);

  const collar = new THREE.Mesh(
    geo(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 16)),
    m.chrome,
  );
  collar.rotation.z = Math.PI / 2;
  collar.position.set(x(0.56), 0, 0);
  arm.add(collar);
}

export function createChestPressModel() {
  bucket = [];
  const m = mats();
  const inner = new THREE.Group();
  side(1, inner, m);
  side(-1, inner, m);

  const add = (mesh: THREE.Mesh) => {
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    inner.add(mesh);
  };

  add(box([2.1, 0.08, 0.08], [0, 0.08, -0.98], m.frame));
  add(box([1.7, 0.08, 0.08], [0, 0.08, 0.95], m.frame));
  add(box([0.08, 0.7, 0.08], [0, 0.42, 0.42], m.frame));
  add(box([0.1, 1.45, 0.1], [0, 1.05, -0.28], m.frame));

  const seat = box([0.56, 0.11, 0.5], [0, 0.78, 0.62], m.pad, [-0.08, 0, 0]);
  seat.name = "seat";
  add(seat);
  const back = box([0.58, 1.15, 0.14], [0, 1.42, -0.12], m.pad, [-0.12, 0, 0]);
  back.name = "backPad";
  add(back);

  for (let i = 0; i < 5; i++) {
    add(box([0.06, 0.015, 0.04], [0.08, 0.48 + i * 0.06, 0.46], m.chrome));
  }

  inner.rotation.y = 0.62;
  inner.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(inner);
  const mid = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  inner.position.sub(mid);

  const root = new THREE.Group();
  root.name = "chest-press";
  root.add(inner);
  root.scale.setScalar(3.6 / Math.max(size.x, size.y, size.z));
  const mine = bucket;
  root.userData.dispose = () => {
    for (const geometry of mine) geometry.dispose();
  };
  return root;
}
