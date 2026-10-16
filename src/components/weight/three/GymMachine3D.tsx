import { useCallback, useRef } from "react";
import * as THREE from "three";
import type { GymMachineId } from "../../../lib/library";
import { GYM_MACHINE_STAGE, GYM_MACHINE_URL } from "../gymMachine";
import { createChestPressModel } from "./createChestPressModel";
import { loadGymMachine } from "./loadGymMachine";
import { frameMaterial } from "./materials";
import { LAT_PULLDOWN_CAM } from "./scale";
import { useWeightStage } from "./useWeightStage";

interface GymMachine3DProps {
  machine: GymMachineId;
  live?: boolean;
}

export function GymMachine3D({
  machine,
  live = true,
}: GymMachine3DProps) {
  const fitRef = useRef<() => void>(() => {});

  const attach = useCallback((pivot: THREE.Group) => {
    let cancelled = false;
    let root: THREE.Object3D | null = null;
    const place = (object: THREE.Object3D) => {
      if (cancelled) return;
      root = object;
      object.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(object);
      object.position.sub(box.getCenter(new THREE.Vector3()));
      pivot.add(object);
      fitRef.current();
    };
    if (machine === "chest-press") {
      place(createChestPressModel());
      return () => {
        cancelled = true;
        const dispose = root?.userData.dispose;
        if (root) pivot.remove(root);
        if (typeof dispose === "function") dispose();
      };
    }
    loadGymMachine(GYM_MACHINE_URL[machine])
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

  const { hostRef, fit } = useWeightStage({
    attach,
    mode: "fixed",
    pose: LAT_PULLDOWN_CAM,
    live,
  });
  fitRef.current = fit;

  return (
    <div
      ref={hostRef}
      className={`${GYM_MACHINE_STAGE[machine]} pointer-events-none`}
      style={{ pointerEvents: "none" }}
      data-gym-machine={machine}
      aria-hidden="true"
    />
  );
}
