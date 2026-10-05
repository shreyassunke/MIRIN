import { useCallback, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import type { GymMachineId } from "../../../lib/library";
import { MANUAL_STEP, round2, type Unit } from "../../../lib/units";
import {
  GYM_MACHINE_LABEL,
  GYM_MACHINE_STAGE,
  GYM_MACHINE_URL,
} from "../gymMachine";
import { frameMaterial } from "./materials";
import { LAT_PULLDOWN_CAM } from "./scale";
import { useWeightStage } from "./useWeightStage";

const cache = new Map<string, Promise<GLTF>>();

function loadMachine(url: string) {
  const hit = cache.get(url);
  if (hit) return hit;
  const pending = new GLTFLoader().loadAsync(url).catch((err) => {
    cache.delete(url);
    throw err;
  });
  cache.set(url, pending);
  return pending;
}

interface GymMachine3DProps {
  machine: GymMachineId;
  unit: Unit;
  value: number;
  onChange?: (value: number) => void;
  live?: boolean;
}

export function GymMachine3D({
  machine,
  unit,
  value,
  onChange,
  live = true,
}: GymMachine3DProps) {
  const valueRef = useRef(value);
  const unitRef = useRef(unit);
  const onChangeRef = useRef(onChange);
  const fitRef = useRef<() => void>(() => {});
  valueRef.current = value;
  unitRef.current = unit;
  onChangeRef.current = onChange;

  const stepBy = useCallback((delta: number) => {
    const step = MANUAL_STEP[unitRef.current];
    const next = round2(Math.max(0, valueRef.current + delta * step));
    if (next !== valueRef.current) onChangeRef.current?.(next);
  }, []);

  const attach = useCallback((pivot: THREE.Group) => {
    let cancelled = false;
    let root: THREE.Object3D | null = null;
    loadMachine(GYM_MACHINE_URL[machine])
      .then((gltf) => {
        if (cancelled) return;
        root = gltf.scene.clone(true);
        const steel = frameMaterial();
        root.traverse((obj) => {
          if (!(obj instanceof THREE.Mesh)) return;
          obj.material = steel;
          obj.castShadow = false;
          obj.receiveShadow = false;
        });
        root.updateWorldMatrix(true, true);
        const box = new THREE.Box3().setFromObject(root);
        const center = box.getCenter(new THREE.Vector3());
        root.position.sub(center);
        pivot.add(root);
        fitRef.current();
      })
      .catch(() => {
        /* The number still logs. The stage just stays empty. */
      });
    return () => {
      cancelled = true;
      if (root) pivot.remove(root);
    };
  }, [machine]);

  const { hostRef, fit, pointer } = useWeightStage({
    attach,
    mode: "fixed",
    pose: LAT_PULLDOWN_CAM,
    onStep: onChange ? stepBy : undefined,
    stepAxis: "y",
    live,
  });
  fitRef.current = fit;
  const stage = `${GYM_MACHINE_STAGE[machine]}${onChange ? " cursor-ns-resize" : ""}`;

  return (
    <div
      ref={hostRef}
      className={stage}
      style={{ touchAction: onChange ? "none" : "pan-y" }}
      role="img"
      aria-label={GYM_MACHINE_LABEL[machine]}
      data-gym-machine={machine}
      {...pointer}
    />
  );
}
