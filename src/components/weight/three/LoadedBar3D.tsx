import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import type { Unit } from "../../../lib/units";
import {
  createBarbellModel,
  type BarbellRuntime,
} from "./createBarbellModel";
import { prefersReducedMotion, useWeightStage } from "./useWeightStage";

interface LoadedBar3DProps {
  unit: Unit;
  plates: number[];
  live?: boolean;
  /** Index in the per-side stack. The inner plate is 0. */
  onRemove?: (index: number) => void;
}

const raycaster = new THREE.Raycaster();

function plateIndexAt(
  plates: THREE.Object3D[],
  ndc: THREE.Vector2,
  camera: THREE.Camera,
) {
  if (plates.length === 0) return null;
  camera.updateMatrixWorld();
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(plates, true);
  for (const hit of hits) {
    let node: THREE.Object3D | null = hit.object;
    while (node) {
      const index = node.userData.plateIndex;
      if (typeof index === "number") return index;
      node = node.parent;
    }
  }
  return null;
}

export function LoadedBar3D({
  unit,
  plates,
  live = true,
  onRemove,
}: LoadedBar3DProps) {
  const runtimeRef = useRef<BarbellRuntime | null>(null);
  const platesRef = useRef(plates);
  const unitRef = useRef(unit);
  platesRef.current = plates;
  unitRef.current = unit;

  const extraFrame = useCallback((now: number) => {
    return runtimeRef.current?.tick(now) ?? false;
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
    attach,
    extraFrame,
    mode: "fixed",
    live,
    onTap: onRemove
      ? (ndc, camera) => {
          if (!live) return;
          const runtime = runtimeRef.current;
          if (!runtime) return;
          const index = plateIndexAt(runtime.plateMeshes, ndc, camera);
          if (index == null) return;
          onRemove(index);
        }
      : undefined,
  });

  useEffect(() => {
    runtimeRef.current?.setPlates(
      plates,
      unit,
      live && !prefersReducedMotion(),
    );
    requestRender();
  }, [plates, unit, live, requestRender]);

  const interactive = Boolean(onRemove) && plates.length > 0;

  return (
    <div
      ref={hostRef}
      data-plates={plates.join(",")}
      className={
        interactive
          ? "weight-stage weight-stage-bar loaded-bar w-full cursor-pointer"
          : "weight-stage weight-stage-bar pointer-events-none w-full"
      }
      style={{ touchAction: "pan-y" }}
      aria-hidden={interactive ? undefined : true}
      role={interactive ? "group" : undefined}
      aria-label={
        interactive
          ? "Loaded bar. Tap a plate to remove it from both sides."
          : undefined
      }
      tabIndex={interactive ? 0 : undefined}
      onPointerDown={(event) => {
        if (!interactive || event.button !== 0) return;
        pointer.onPointerDown(event.nativeEvent);
      }}
      onPointerMove={(event) => {
        if (!interactive) return;
        pointer.onPointerMove(event.nativeEvent);
      }}
      onPointerUp={(event) => {
        if (!interactive) return;
        pointer.onPointerUp(event.nativeEvent);
      }}
      onPointerCancel={(event) => {
        if (!interactive) return;
        pointer.onPointerCancel(event.nativeEvent);
      }}
      onPointerLeave={() => {
        if (!interactive) return;
        pointer.onPointerLeave();
      }}
      onKeyDown={(event) => {
        if (!interactive || !onRemove) return;
        if (event.key !== "Backspace" && event.key !== "Delete") return;
        event.preventDefault();
        onRemove(plates.length - 1);
      }}
    />
  );
}
