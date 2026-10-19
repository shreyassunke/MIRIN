import * as THREE from "three";
import { frameMaterial, steelMaterial } from "./materials";

/**
 * Selectorized shoulder press, rebuilt from the reference views as primitives.
 * The printed placard and brand mark are left off. Upholstery stays in the
 * same black as the other instruments; the stack, cams, and overhead bar
 * carry the silhouette.
 *
 * The back of the shroud is the front, mirrored. Plate grooves are a generic
 * stack, not a copied number chart. `pressPivot` swings both handles about
 * the axle; nothing in the logging stage calls `userData.tick`.
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
  const length = Math.max(dir.length(), 1e-4);
  const mesh = new THREE.Mesh(geo(new THREE.BoxGeometry(width, height, length)), material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.normalize());
  return mesh;
}

function rod(
  a: THREE.Vector3,
  b: THREE.Vector3,
  radius: number,
  material: THREE.Material,
) {
  const dir = b.clone().sub(a);
  const length = Math.max(dir.length(), 1e-4);
  const mesh = new THREE.Mesh(
    geo(new THREE.CylinderGeometry(radius, radius, length, 12)),
    material,
  );
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
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

/** Upholstered slab. Width and height sit in XY; depth is the cushion. */
function roundedSlab(width: number, height: number, depth: number, radius: number) {
  const r = Math.min(radius, width * 0.42, height * 0.42);
  const x = -width / 2;
  const y = -height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.absarc(x + width - r, y + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(x + width, y + height - r);
  shape.absarc(x + width - r, y + height - r, r, 0, Math.PI / 2, false);
  shape.lineTo(x + r, y + height);
  shape.absarc(x + r, y + height - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(x, y + r);
  shape.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: Math.min(0.012, depth * 0.28),
    bevelSize: Math.min(0.012, r * 0.45),
    bevelSegments: 2,
    curveSegments: 8,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geo(geometry);
}

let materials: {
  frame: THREE.Material;
  steel: THREE.Material;
  pad: THREE.MeshStandardMaterial;
  rubber: THREE.MeshStandardMaterial;
  plate: THREE.MeshStandardMaterial;
  window: THREE.MeshStandardMaterial;
  skirt: THREE.MeshStandardMaterial;
  cable: THREE.MeshStandardMaterial;
} | null = null;

function mats() {
  if (materials) return materials;
  materials = {
    frame: frameMaterial(),
    steel: steelMaterial("shoulder-press-steel"),
    pad: new THREE.MeshStandardMaterial({
      color: "#161618",
      metalness: 0.02,
      roughness: 0.9,
      envMapIntensity: 0.4,
    }),
    rubber: new THREE.MeshStandardMaterial({
      color: "#101010",
      metalness: 0.06,
      roughness: 0.62,
      envMapIntensity: 0.45,
    }),
    plate: new THREE.MeshStandardMaterial({
      color: "#4a4a4e",
      metalness: 0.28,
      roughness: 0.55,
      envMapIntensity: 0.7,
    }),
    window: new THREE.MeshStandardMaterial({
      color: "#1c1c20",
      metalness: 0.08,
      roughness: 0.72,
      envMapIntensity: 0.4,
    }),
    skirt: new THREE.MeshStandardMaterial({
      color: "#2a2a2e",
      metalness: 0.45,
      roughness: 0.46,
      envMapIntensity: 0.8,
    }),
    cable: new THREE.MeshStandardMaterial({
      color: "#0a0a0a",
      metalness: 0.04,
      roughness: 0.8,
    }),
  };
  return materials;
}

function add(parent: THREE.Object3D, mesh: THREE.Object3D) {
  mesh.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    obj.castShadow = false;
    obj.receiveShadow = false;
  });
  parent.add(mesh);
  return mesh;
}

export function createShoulderPressModel() {
  bucket = [];
  const m = mats();
  const inner = new THREE.Group();

  const stackX = -0.52;
  const stackZ = -0.02;
  const stackH = 1.42;
  const stackTop = 0.08 + stackH;

  const shroud = new THREE.Group();
  shroud.name = "shroud";
  shroud.position.set(stackX, 0, stackZ);
  inner.add(shroud);

  const column = new THREE.Mesh(
    geo(new THREE.CylinderGeometry(0.155, 0.168, stackH, 28)),
    m.frame,
  );
  column.scale.set(1.28, 1, 1);
  column.position.y = 0.08 + stackH / 2;
  add(shroud, column);

  const cap = new THREE.Mesh(geo(new THREE.SphereGeometry(0.155, 24, 16)), m.frame);
  cap.scale.set(1.28, 0.42, 1);
  cap.position.y = stackTop;
  add(shroud, cap);

  const skirt = new THREE.Mesh(
    geo(new THREE.CylinderGeometry(0.2, 0.22, 0.07, 28)),
    m.skirt,
  );
  skirt.scale.set(1.22, 1, 1);
  skirt.position.y = 0.045;
  add(shroud, skirt);

  const foot = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.24, 0.24, 0.025, 24)), m.rubber);
  foot.scale.set(1.15, 1, 0.9);
  foot.position.y = 0.012;
  add(shroud, foot);

  const placard = box([0.26, 0.2, 0.02], [0, stackTop - 0.22, 0.175], m.rubber);
  placard.name = "placard";
  add(shroud, placard);

  const window = box([0.24, 0.78, 0.02], [0, 0.62, 0.178], m.window);
  add(shroud, window);

  const weightStack = new THREE.Group();
  weightStack.name = "weightStack";
  shroud.add(weightStack);
  for (let i = 0; i < 12; i++) {
    const plate = box([0.2, 0.028, 0.018], [0, 0.32 + i * 0.058, 0.192], m.plate);
    add(weightStack, plate);
  }
  const guide = rod(
    new THREE.Vector3(0.07, 0.28, 0.2),
    new THREE.Vector3(0.07, 1.05, 0.2),
    0.008,
    m.steel,
  );
  add(weightStack, guide);
  const pin = new THREE.Mesh(geo(new THREE.SphereGeometry(0.016, 10, 8)), m.rubber);
  pin.position.set(0.1, 0.55, 0.21);
  pin.name = "stackPin";
  add(weightStack, pin);

  const frame = m.frame;
  const put = (mesh: THREE.Mesh) => add(inner, mesh);

  put(beam(new THREE.Vector3(stackX, 0.08, stackZ), new THREE.Vector3(0.46, 0.08, 0.06), 0.07, 0.06, frame));
  put(beam(new THREE.Vector3(0.02, 0.08, 0.06), new THREE.Vector3(0.02, 0.08, 0.5), 0.07, 0.06, frame));
  put(beam(new THREE.Vector3(stackX + 0.05, 0.46, 0.02), new THREE.Vector3(0.28, 0.5, 0.08), 0.05, 0.05, frame));

  const mast = box([0.07, 1.05, 0.07], [0.1, 0.66, -0.18], frame);
  put(mast);
  put(box([0.07, 0.72, 0.07], [0.04, 0.42, 0.22], frame));

  put(box([0.06, 1.08, 0.06], [0.42, 0.6, -0.06], frame));
  put(beam(new THREE.Vector3(0.1, 1.18, -0.18), new THREE.Vector3(0.4, 1.22, -0.04), 0.05, 0.05, frame));
  put(beam(new THREE.Vector3(0.42, 0.72, -0.06), new THREE.Vector3(0.1, 0.5, 0.16), 0.045, 0.045, frame));

  for (const [x, z] of [
    [0.42, -0.06],
    [0.02, 0.42],
  ] as const) {
    const glide = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.045, 0.05, 0.02, 12)), m.rubber);
    glide.position.set(x, 0.01, z);
    put(glide);
  }

  const seat = new THREE.Mesh(roundedSlab(0.4, 0.36, 0.09, 0.05), m.pad);
  seat.name = "seat";
  seat.rotation.x = Math.PI / 2 - 0.06;
  seat.position.set(0.02, 0.54, 0.2);
  add(inner, seat);
  put(box([0.28, 0.03, 0.24], [0.02, 0.48, 0.18], frame));

  const knob = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.028, 0.028, 0.06, 12)), m.rubber);
  knob.rotation.z = Math.PI / 2;
  knob.position.set(0.12, 0.4, 0.22);
  put(knob);

  const back = new THREE.Mesh(roundedSlab(0.36, 0.78, 0.1, 0.05), m.pad);
  back.name = "backPad";
  back.rotation.x = -0.18;
  back.position.set(0.02, 1.0, 0.05);
  add(inner, back);

  const head = new THREE.Mesh(roundedSlab(0.24, 0.18, 0.12, 0.04), m.pad);
  head.name = "headrest";
  head.rotation.x = -0.14;
  head.position.set(0.02, 1.38, -0.06);
  add(inner, head);

  const pivotPos = new THREE.Vector3(0.04, 1.34, 0.06);
  const pressPivot = new THREE.Group();
  pressPivot.name = "pressPivot";
  pressPivot.position.copy(pivotPos);
  inner.add(pressPivot);

  const bar = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.026, 0.026, 1.55, 16)), m.steel);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, -0.02, 0.22);
  add(pressPivot, bar);

  const hands: Array<[number, string, string]> = [
    [-1, "gripLeft", "camLeft"],
    [1, "gripRight", "camRight"],
  ];
  for (const [sign, gripName, camName] of hands) {
    const x = 0.72 * sign;
    const grip = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.032, 0.032, 0.22, 16)), m.rubber);
    grip.rotation.z = Math.PI / 2;
    grip.position.set(x, -0.05, 0.28);
    grip.name = gripName;
    add(pressPivot, grip);
    for (let i = -2; i <= 2; i++) {
      const ring = new THREE.Mesh(geo(new THREE.TorusGeometry(0.036, 0.0045, 6, 14)), m.rubber);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(grip.position.x + i * 0.032 * sign, grip.position.y, grip.position.z);
      add(pressPivot, ring);
    }

    const cam = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.1, 0.1, 0.046, 28)), m.rubber);
    cam.rotation.x = Math.PI / 2;
    cam.position.set(x + 0.18 * sign, 0.02, 0.14);
    cam.name = camName;
    add(pressPivot, cam);
    const hub = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.026, 0.026, 0.054, 14)), m.steel);
    hub.rotation.x = Math.PI / 2;
    hub.position.copy(cam.position);
    add(pressPivot, hub);
  }

  const linkTop = pivotPos.clone().add(new THREE.Vector3(0.78, -0.02, 0.2));
  const linkBottom = new THREE.Vector3(0.42, 0.78, -0.02);
  put(rod(linkTop, linkBottom, 0.012, m.steel));
  const linkHub = new THREE.Mesh(geo(new THREE.SphereGeometry(0.02, 10, 8)), m.steel);
  linkHub.position.copy(linkBottom);
  put(linkHub);

  const upperPulley = new THREE.Mesh(geo(new THREE.TorusGeometry(0.055, 0.012, 8, 16)), m.rubber);
  upperPulley.rotation.y = Math.PI / 2;
  upperPulley.position.set(-0.22, 1.16, -0.02);
  put(upperPulley);
  const upperHub = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.016, 0.016, 0.04, 10)), m.steel);
  upperHub.rotation.z = Math.PI / 2;
  upperHub.position.copy(upperPulley.position);
  put(upperHub);

  const midPulley = new THREE.Mesh(geo(new THREE.TorusGeometry(0.07, 0.014, 8, 18)), m.rubber);
  midPulley.rotation.y = Math.PI / 2;
  midPulley.position.set(-0.24, 0.58, 0.06);
  put(midPulley);
  const midHub = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.018, 0.018, 0.04, 10)), m.steel);
  midHub.rotation.z = Math.PI / 2;
  midHub.position.copy(midPulley.position);
  put(midHub);

  const cable = new THREE.Mesh(
    geo(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(stackX + 0.02, stackTop - 0.08, 0.16),
          new THREE.Vector3(-0.22, 1.16, 0.02),
          new THREE.Vector3(-0.24, 0.58, 0.08),
          new THREE.Vector3(stackX + 0.08, 0.22, 0.12),
        ]),
        40,
        0.008,
        5,
        false,
      ),
    ),
    m.cable,
  );
  put(cable);

  inner.rotation.y = 0.58;
  inner.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(inner);
  const mid = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  inner.position.sub(mid);

  const root = new THREE.Group();
  root.name = "shoulder-press";
  root.add(inner);
  root.scale.setScalar(3.5 / Math.max(size.x, size.y, size.z));

  const press = pressPivot;
  const restX = press.rotation.x;
  root.userData.sculptRuntime = {
    nodes: {
      pressPivot: press,
      weightStack,
      seat,
      backPad: back,
      shroud,
    },
    sockets: {
      gripLeft: press.getObjectByName("gripLeft"),
      gripRight: press.getObjectByName("gripRight"),
      stackPin: pin,
    },
    colliders: [],
    destructionGroups: [],
  };
  root.userData.tick = (t: number) => {
    press.rotation.x = restX - ((Math.sin(t * 0.9) + 1) / 2) * 0.5;
  };

  const mine = bucket;
  root.userData.dispose = () => {
    for (const geometry of mine) geometry.dispose();
  };
  return root;
}
