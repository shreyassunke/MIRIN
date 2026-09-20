import { useCallback, useEffect, useRef } from "react";
import type { Group } from "three";
import { formatWeight } from "../../../lib/workout";
import type { Unit } from "../../../lib/units";
import {
  createDumbbellModel,
  type DumbbellRuntime,
} from "./createDumbbellModel";
import { DUMBBELL_CAM } from "./scale";
import { useWeightStage } from "./useWeightStage";

interface Dumbbell3DProps {
  unit: Unit;
  value: number;
}

export function Dumbbell3D({ unit, value }: Dumbbell3DProps) {
  const runtimeRef = useRef<DumbbellRuntime | null>(null);
  const valueRef = useRef(value);
  const unitRef = useRef(unit);
  valueRef.current = value;
  unitRef.current = unit;

  const attach = useCallback((pivot: Group) => {
    const model = createDumbbellModel();
    pivot.add(model);
    const runtime = model.userData.sculptRuntime as DumbbellRuntime;
    runtimeRef.current = runtime;
    runtime.setWeight(valueRef.current, unitRef.current);
    return () => {
      pivot.remove(model);
      runtime.dispose();
      runtimeRef.current = null;
    };
  }, []);

  const { hostRef, requestRender, pointer } = useWeightStage({
    attach,
    mode: "fixed",
    pose: DUMBBELL_CAM,
  });

  useEffect(() => {
    runtimeRef.current?.setWeight(value, unit);
    requestRender();
  }, [value, unit, requestRender]);

  return (
    <div
      ref={hostRef}
      className="h-[88px] w-52"
      style={{ touchAction: "pan-y" }}
      role="img"
      aria-label={`${formatWeight(value)} ${unit} dumbbell`}
      {...pointer}
    />
  );
}
