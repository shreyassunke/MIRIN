import { useCallback, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { MANUAL_STEP, round2, type Unit } from "../../../lib/units";
import { frameMaterial } from "./materials";
import { LAT_PULLDOWN_CAM } from "./scale";
import { useWeightStage } from "./useWeightStage";

const MODEL_URL = "/models/lat-pulldown.glb";

let latGltf: Promise<GLTF> | null = null;

function loadLatPulldown() {
  if (!latGltf) {
    latGltf = new GLTFLoader().loadAsync(MODEL_URL).catch((err) => {
      latGltf = null;
      throw err;
    });
  }
  return latGltf;
}

interface LatPulldown3DProps {
  unit: Unit;
  value: number;
  onChange?: (value: number) => void;
  live?: boolean;
}

export function LatPulldown3D({
  unit,
  value,
  onChange,
  live = true,
}: LatPulldown3DProps) {
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
    loadLatPulldown()
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
  }, []);

  const { hostRef, fit, pointer } = useWeightStage({
    attach,
    mode: "fixed",
    pose: LAT_PULLDOWN_CAM,
    onStep: onChange ? stepBy : undefined,
    stepAxis: "y",
    live,
  });
  fitRef.current = fit;

  return (
    <div
      ref={hostRef}
      className={
        onChange
          ? "mx-auto h-64 w-full max-w-sm cursor-ns-resize"
          : "mx-auto h-64 w-full max-w-sm"
      }
      style={{ touchAction: onChange ? "none" : "pan-y" }}
      role="img"
      aria-label="Lat pulldown machine"
      data-lat-pulldown=""
      {...pointer}
    />
  );
}
