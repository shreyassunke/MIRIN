import { useCallback, useEffect, useRef } from "react";
import type { Group, Mesh } from "three";
import * as THREE from "three";
import { DUMBBELL_SIZES, type Unit } from "../../../lib/units";
import {
  createDumbbellModel,
  type DumbbellRuntime,
} from "./createDumbbellModel";
import {
  DB_COLLAR_T,
  DB_HANDLE_LEN,
  DUMBBELL_CAM,
  dumbbellMaxHeadDims,
} from "./scale";
import { useWeightStage } from "./useWeightStage";

const PAIR_GAP = 3;

interface Dumbbell3DProps {
  unit: Unit;
  value: number;
  pair?: boolean;
  onChange?: (value: number) => void;
  onTap?: () => void;
  onSwipe?: (direction: -1 | 1) => void;
  live?: boolean;
}

type PairRuntime = {
  a: DumbbellRuntime;
  b: DumbbellRuntime;
  set: Group;
  fitBounds: Mesh;
  oneH: number;
};

function applyPairLayout(runtime: PairRuntime, pair: boolean) {
  const sep = dumbbellMaxHeadDims().radius * 2 + PAIR_GAP;
  const bellA = runtime.set.getObjectByName("bellA");
  const bellB = runtime.set.getObjectByName("bellB");
  if (bellA) bellA.position.y = pair ? sep / 2 : 0;
  if (bellB) {
    bellB.position.y = pair ? -sep / 2 : 0;
    bellB.visible = pair;
  }
  runtime.fitBounds.scale.y = pair ? (runtime.oneH + sep) / runtime.oneH : 1;
}

export function Dumbbell3D({
  unit,
  value,
  pair = false,
  onChange,
  onTap,
  onSwipe,
  live = true,
}: Dumbbell3DProps) {
  const runtimeRef = useRef<PairRuntime | null>(null);
  const valueRef = useRef(value);
  const unitRef = useRef(unit);
  const pairRef = useRef(pair);
  const onChangeRef = useRef(onChange);
  const onTapRef = useRef(onTap);
  valueRef.current = value;
  unitRef.current = unit;
  pairRef.current = pair;
  onChangeRef.current = onChange;
  onTapRef.current = onTap;

  const stepBy = useCallback((delta: number) => {
    const sizes = DUMBBELL_SIZES[unitRef.current];
    const current = sizes.indexOf(valueRef.current);
    const index = current < 0 ? 0 : current;
    const next = Math.max(0, Math.min(sizes.length - 1, index + delta));
    if (sizes[next] !== valueRef.current) onChangeRef.current?.(sizes[next]);
  }, []);

  const attach = useCallback((pivot: Group) => {
    const set = new THREE.Group();
    set.name = "dumbbellSet";
    const a = createDumbbellModel();
    const b = createDumbbellModel();
    a.name = "bellA";
    b.name = "bellB";
    const fitA = a.getObjectByName("fitBounds");
    const fitB = b.getObjectByName("fitBounds");
    if (fitA) fitA.name = "bellFit";
    if (fitB) fitB.name = "bellFit";

    const max = dumbbellMaxHeadDims();
    const maxHeadX = DB_HANDLE_LEN / 2 + DB_COLLAR_T + max.thickness / 2;
    const oneW = (maxHeadX + max.thickness / 2) * 2;
    const oneH = max.radius * 2;
    const fitGeo = new THREE.BoxGeometry(oneW, oneH, max.radius * 2);
    const fitBounds = new THREE.Mesh(fitGeo);
    fitBounds.visible = false;
    fitBounds.name = "fitBounds";

    set.add(a);
    set.add(b);
    set.add(fitBounds);
    pivot.add(set);

    const runtimeA = a.userData.sculptRuntime as DumbbellRuntime;
    const runtimeB = b.userData.sculptRuntime as DumbbellRuntime;
    const runtime: PairRuntime = {
      a: runtimeA,
      b: runtimeB,
      set,
      fitBounds,
      oneH,
    };
    runtimeRef.current = runtime;
    applyPairLayout(runtime, pairRef.current);
    runtimeA.setWeight(valueRef.current, unitRef.current);
    runtimeB.setWeight(valueRef.current, unitRef.current);

    return () => {
      pivot.remove(set);
      runtimeA.dispose();
      runtimeB.dispose();
      fitGeo.dispose();
      runtimeRef.current = null;
    };
  }, []);

  const { hostRef, requestRender, fit, pointer } = useWeightStage({
    attach,
    mode: "fixed",
    pose: DUMBBELL_CAM,
    onStep: onChange ? stepBy : undefined,
    stepAxis: "y",
    onSwipe,
    live,
    onTap: onTap
      ? () => {
          onTapRef.current?.();
        }
      : undefined,
  });

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.a.setWeight(value, unit);
    runtime.b.setWeight(value, unit);
    applyPairLayout(runtime, pair);
    fit();
    requestRender();
  }, [value, unit, pair, fit, requestRender]);

  const interactive = Boolean(onChange || onTap || onSwipe);

  return (
    <div
      ref={hostRef}
      className={
        interactive
          ? "mx-auto h-36 w-full max-w-xs cursor-ns-resize"
          : "mx-auto h-36 w-full max-w-xs"
      }
      style={{ touchAction: onChange ? "none" : "pan-y" }}
      aria-hidden="true"
      {...pointer}
    />
  );
}
