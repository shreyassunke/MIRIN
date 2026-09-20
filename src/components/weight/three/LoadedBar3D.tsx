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

/** Matches the SVG fallback's 44px plate hit so edge-on taps still land. */
const PLATE_HIT_PX = 44;
const _hitBox = new THREE.Box3();
const _hitCorner = new THREE.Vector3();

function plateIndexFromHit(object: THREE.Object3D): number | null {
  let obj: THREE.Object3D | null = object;
  while (obj && obj.userData.plateIndex == null) obj = obj.parent;
  return typeof obj?.userData.plateIndex === "number"
    ? obj.userData.plateIndex
    : null;
}

function plateIndexFromScreen(
  ndc: THREE.Vector2,
  camera: THREE.Camera,
  plates: THREE.Object3D[],
  rect: DOMRectReadOnly,
): number | null {
  const px = ((ndc.x + 1) / 2) * rect.width;
  const py = ((1 - ndc.y) / 2) * rect.height;
  const pad = PLATE_HIT_PX / 2;
  let best: number | null = null;
  let bestDx = Infinity;

  for (const plate of plates) {
    const index = plateIndexFromHit(plate);
    if (index == null) continue;
    _hitBox.setFromObject(plate);
    if (_hitBox.isEmpty()) continue;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const x of [_hitBox.min.x, _hitBox.max.x]) {
      for (const y of [_hitBox.min.y, _hitBox.max.y]) {
        for (const z of [_hitBox.min.z, _hitBox.max.z]) {
          _hitCorner.set(x, y, z).project(camera);
          const sx = ((_hitCorner.x + 1) / 2) * rect.width;
          const sy = ((1 - _hitCorner.y) / 2) * rect.height;
          minX = Math.min(minX, sx);
          maxX = Math.max(maxX, sx);
          minY = Math.min(minY, sy);
          maxY = Math.max(maxY, sy);
        }
      }
    }
    if (
      px < minX - pad ||
      px > maxX + pad ||
      py < minY - pad ||
      py > maxY + pad
    ) {
      continue;
    }
    const dx = Math.abs(px - (minX + maxX) / 2);
    if (dx < bestDx) {
      bestDx = dx;
      best = index;
    }
  }
  return best;
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

  const onTap = useCallback(
    (ndc: THREE.Vector2, camera: THREE.Camera, rect: DOMRectReadOnly) => {
      const runtime = runtimeRef.current;
      if (!runtime) return;
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(runtime.plateMeshes, true);
      const direct = hits[0] ? plateIndexFromHit(hits[0].object) : null;
      const index =
        direct ??
        plateIndexFromScreen(ndc, camera, runtime.plateMeshes, rect);
      if (index != null) onRemoveRef.current(index);
    },
    [],
  );

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

  const { hostRef, requestRender, fit, pointer } = useWeightStage({
    attach,
    extraFrame,
    onTap,
    mode: "fixed",
  });

  useEffect(() => {
    runtimeRef.current?.setPlates(plates, unit, !prefersReducedMotion());
    fit();
    requestRender();
  }, [plates, unit, fit, requestRender]);

  const label = plates.length
    ? `Bar loaded with ${plates.map((p) => formatWeight(p)).join(", ")} per side`
    : "Empty bar";

  return (
    <div className="relative w-full">
      <div
        ref={hostRef}
        className={`w-full ${plates.length ? "cursor-pointer" : ""}`}
        style={{ height: 104, touchAction: "pan-y" }}
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
