import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import type { VariationHit } from "../ModelHit";
import { MODEL_TAP_PX } from "../modelTap";
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
  /** A tap that misses every plate opens the variation list. */
  hit?: VariationHit;
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
  hit,
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
    onTap:
      onRemove || hit
        ? (ndc, camera) => {
            if (!live) return;
            const runtime = runtimeRef.current;
            if (onRemove && runtime) {
              const index = plateIndexAt(runtime.plateMeshes, ndc, camera);
              if (index != null) {
                onRemove(index);
                return;
              }
            }
            if (hit && (hit.live ?? true)) hit.onToggle();
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

  const press = useRef<{ x: number; y: number } | null>(null);
  const interactive = Boolean(hit) || (Boolean(onRemove) && plates.length > 0);
  const plateHint = Boolean(onRemove) && plates.length > 0;

  return (
    <div
      ref={hostRef}
      data-plates={plates.join(",")}
      data-variation-trigger={hit ? "" : undefined}
      className={
        interactive
          ? "weight-stage weight-stage-bar loaded-bar w-full cursor-pointer"
          : "weight-stage weight-stage-bar pointer-events-none w-full"
      }
      style={{ touchAction: "pan-y" }}
      aria-hidden={interactive ? undefined : true}
      role={hit ? "button" : interactive ? "group" : undefined}
      aria-haspopup={hit ? "listbox" : undefined}
      aria-expanded={hit ? hit.expanded : undefined}
      aria-controls={hit?.expanded ? hit.controls : undefined}
      aria-label={
        hit
          ? plateHint
            ? `${hit.label}. Tap a plate to remove it from both sides.`
            : hit.label
          : plateHint
            ? "Loaded bar. Tap a plate to remove it from both sides."
            : undefined
      }
      tabIndex={interactive ? 0 : undefined}
      onPointerDown={(event) => {
        if (!interactive || event.button !== 0) return;
        press.current = { x: event.clientX, y: event.clientY };
        event.currentTarget.dataset.pressed = "";
        pointer.onPointerDown(event.nativeEvent);
      }}
      onPointerMove={(event) => {
        if (!interactive) return;
        const origin = press.current;
        if (
          origin &&
          (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > MODEL_TAP_PX ||
            event.currentTarget.closest(".is-paging"))
        ) {
          delete event.currentTarget.dataset.pressed;
        }
        pointer.onPointerMove(event.nativeEvent);
      }}
      onPointerUp={(event) => {
        if (!interactive) return;
        press.current = null;
        delete event.currentTarget.dataset.pressed;
        pointer.onPointerUp(event.nativeEvent);
      }}
      onPointerCancel={(event) => {
        if (!interactive) return;
        press.current = null;
        delete event.currentTarget.dataset.pressed;
        pointer.onPointerCancel(event.nativeEvent);
      }}
      onPointerLeave={() => {
        if (!interactive) return;
        press.current = null;
        const host = hostRef.current;
        if (host) delete host.dataset.pressed;
        pointer.onPointerLeave();
      }}
      onKeyDown={(event) => {
        if (!interactive || event.repeat) return;
        if (hit && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          if (hit.live ?? live) hit.onToggle();
          return;
        }
        if (!onRemove) return;
        if (event.key !== "Backspace" && event.key !== "Delete") return;
        event.preventDefault();
        if (plates.length === 0) return;
        onRemove(plates.length - 1);
      }}
    />
  );
}
