import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import { formatWeight } from "../../../lib/workout";
import type { Unit } from "../../../lib/units";
import {
  createBarbellModel,
  type BarbellRuntime,
} from "./createBarbellModel";
import { prefersReducedMotion, useWeightStage } from "./useWeightStage";

interface LoadedBar3DProps {
  unit: Unit;
  plates: number[];
  onRemove: (index: number) => void;
}

export function LoadedBar3D({ unit, plates, onRemove }: LoadedBar3DProps) {
  const runtimeRef = useRef<BarbellRuntime | null>(null);
  const platesRef = useRef(plates);
  const unitRef = useRef(unit);
  const onRemoveRef = useRef(onRemove);
  platesRef.current = plates;
  unitRef.current = unit;
  onRemoveRef.current = onRemove;

  const extraFrame = useCallback((now: number) => {
    return runtimeRef.current?.tick(now) ?? false;
  }, []);

  const onTap = useCallback((ndc: THREE.Vector2, camera: THREE.Camera) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(runtime.plateMeshes, true);
    const hit = hits[0];
    if (!hit) return;
    let obj: THREE.Object3D | null = hit.object;
    while (obj && obj.userData.plateIndex == null) obj = obj.parent;
    if (obj && typeof obj.userData.plateIndex === "number") {
      onRemoveRef.current(obj.userData.plateIndex);
    }
  }, []);

  const attach = useCallback((pivot: THREE.Group) => {
    const model = createBarbellModel();
    pivot.add(model);
    const runtime = model.userData.sculptRuntime as BarbellRuntime;
    runtimeRef.current = runtime;
    runtime.setPlates(platesRef.current, unitRef.current, false);
    return () => {
      pivot.remove(model);
      runtime.dispose();
      runtimeRef.current = null;
    };
  }, []);

  const { hostRef, requestRender, pointer } = useWeightStage({
    cameraZ: 2.05,
    attach,
    extraFrame,
    onTap,
  });

  useEffect(() => {
    runtimeRef.current?.setPlates(plates, unit, !prefersReducedMotion());
    requestRender();
  }, [plates, unit, requestRender]);

  const label = plates.length
    ? `Bar loaded with ${plates.map((p) => formatWeight(p)).join(", ")} per side`
    : "Empty bar";

  return (
    <div className="relative w-full max-w-80">
      <div
        ref={hostRef}
        className="w-full"
        style={{ height: 92, touchAction: "pan-y" }}
        role="img"
        aria-label={label}
        {...pointer}
      />
      <div className="sr-only">
        {plates.map((value, index) => (
          <button
            key={`${value}-${index}`}
            type="button"
            onClick={() => onRemove(index)}
          >
            Remove {formatWeight(value)} {unit} plate
          </button>
        ))}
      </div>
    </div>
  );
}
