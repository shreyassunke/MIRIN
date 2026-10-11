import * as THREE from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import type { GymMachineId } from "../../../lib/library";
import { GYM_MACHINE_URL } from "../gymMachine";
import { createChestPressModel } from "./createChestPressModel";
import { loadGymMachine } from "./loadGymMachine";
import { frameMaterial } from "./materials";
import { fitFixedCamera, LAT_PULLDOWN_CAM } from "./scale";
import { bakeSceneToCanvas, createInstrumentScene } from "./stage";

/** Backing store for an icon-sized still. CSS scales it into the cell. */
const PX = 160;

const cache = new Map<GymMachineId, HTMLCanvasElement>();
const inflight = new Map<GymMachineId, Promise<HTMLCanvasElement>>();
let tail: Promise<void> = Promise.resolve();

function enqueue(fn: () => Promise<void>) {
  const run = tail.then(fn, fn);
  tail = run.then(
    () => undefined,
    () => undefined,
  );
}

/**
 * One still of the station mesh, same steel and camera as the logging stage.
 * Loads may overlap. Bakes share the one renderer, so they run in order.
 */
export function machineThumb(id: GymMachineId): Promise<HTMLCanvasElement> {
  const hit = cache.get(id);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(id);
  if (pending) return pending;

  const job = (
    id === "chest-press"
      ? Promise.resolve(null)
      : loadGymMachine(GYM_MACHINE_URL[id])
  ).then(
    (gltf) =>
      new Promise<HTMLCanvasElement>((resolve, reject) => {
        enqueue(async () => {
          try {
            const canvas = gltf ? renderThumb(gltf) : renderObject(createChestPressModel());
            cache.set(id, canvas);
            resolve(canvas);
          } catch (err) {
            reject(err);
          } finally {
            inflight.delete(id);
          }
        });
      }),
  );
  inflight.set(id, job);
  return job;
}

function renderThumb(gltf: GLTF) {
  const root = gltf.scene.clone(true);
  const steel = frameMaterial();
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    obj.material = steel;
    obj.castShadow = false;
    obj.receiveShadow = false;
  });
  return renderObject(root);
}

function renderObject(root: THREE.Object3D) {
  root.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  root.position.sub(center);

  const scene = createInstrumentScene({ symmetric: true });
  const pivot = new THREE.Group();
  pivot.add(root);
  scene.add(pivot);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 600);
  fitFixedCamera(camera, pivot, PX, PX, LAT_PULLDOWN_CAM);

  const dest = document.createElement("canvas");
  dest.width = PX;
  dest.height = PX;
  bakeSceneToCanvas(scene, camera, dest);
  const dispose = root.userData.dispose;
  if (typeof dispose === "function") dispose();
  return dest;
}
