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
}

export function LoadedBar3D({
  unit,
  plates,
  live = true,
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

  const { hostRef, requestRender } = useWeightStage({
    attach,
    extraFrame,
    mode: "fixed",
    live,
  });

  useEffect(() => {
    runtimeRef.current?.setPlates(
      plates,
      unit,
      live && !prefersReducedMotion(),
    );
    requestRender();
  }, [plates, unit, live, requestRender]);

  return (
    <div
      ref={hostRef}
      className="pointer-events-none w-full"
      style={{ height: 104, pointerEvents: "none" }}
      aria-hidden="true"
    />
  );
}
