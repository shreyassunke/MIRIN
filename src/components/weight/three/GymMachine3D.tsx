import { useCallback, useRef } from "react";
import * as THREE from "three";
import type { GymMachineId } from "../../../lib/library";
import { MANUAL_STEP, round2, type Unit } from "../../../lib/units";
import {
  GYM_MACHINE_LABEL,
  GYM_MACHINE_STAGE,
  GYM_MACHINE_URL,
} from "../gymMachine";
import { createChestPressModel } from "./createChestPressModel";
import { loadGymMachine } from "./loadGymMachine";
import { frameMaterial } from "./materials";
import { LAT_PULLDOWN_CAM } from "./scale";
import { useWeightStage } from "./useWeightStage";

interface GymMachine3DProps {
  machine: GymMachineId;
  unit: Unit;
  value: number;
  onChange?: (value: number) => void;
  /** Sideways drift inside the vertical weight drag. True when the step landed. */
  onRepStep?: (direction: -1 | 1) => boolean;
  live?: boolean;
  /** A tap on the station, short of a drag, opens the variation list. */
  onEdit?: () => void;
}

export function GymMachine3D({
  machine,
  unit,
  value,
  onChange,
  onRepStep,
  live = true,
  onEdit,
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

  const { hostRef, fit, pointer } = useWeightStage({
    attach,
    mode: "fixed",
    pose: LAT_PULLDOWN_CAM,
    onStep: onChange ? stepBy : undefined,
    onCrossStep: onRepStep,
    stepAxis: "y",
    onTap: onEdit ? () => onEdit() : undefined,
    live,
  });
  fitRef.current = fit;
  const stage = `${GYM_MACHINE_STAGE[machine]}${onChange ? " cursor-ns-resize" : ""}`;

  return (
    <div
      ref={hostRef}
      className={stage}
      style={{ touchAction: onChange ? "none" : "pan-y" }}
      role={onEdit ? "button" : "img"}
      tabIndex={onEdit ? 0 : undefined}
      onKeyDown={
        onEdit
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onEdit();
              }
            }
          : undefined
      }
      aria-label={
        onEdit
          ? `${GYM_MACHINE_LABEL[machine]}.${onRepStep ? " Slide up or down for weight. Drift sideways while sliding for reps." : ""} Activate to change variation`
          : GYM_MACHINE_LABEL[machine]
      }
      data-gym-machine={machine}
      {...pointer}
    />
  );
}
