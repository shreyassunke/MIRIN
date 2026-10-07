import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import {
  cableAttachmentLabel,
  type CableAttachmentId,
} from "../../../lib/cableAttachment";
import { MANUAL_STEP, round2, type Unit } from "../../../lib/units";
import {
  createCableAttachmentSet,
  type CableAttachmentSet,
} from "./createCableAttachment";
import { CABLE_CAM } from "./scale";
import { useWeightStage } from "./useWeightStage";

const STAGE = "mx-auto h-52 w-full max-w-sm";

interface CableAttachment3DProps {
  attachment: CableAttachmentId;
  unit: Unit;
  value: number;
  onChange: (value: number) => void;
  live?: boolean;
}

export function CableAttachment3D({
  attachment,
  unit,
  value,
  onChange,
  live = true,
}: CableAttachment3DProps) {
  const valueRef = useRef(value);
  const unitRef = useRef(unit);
  const onChangeRef = useRef(onChange);
  const attachmentRef = useRef(attachment);
  const apiRef = useRef<CableAttachmentSet | null>(null);
  const fitRef = useRef<() => void>(() => {});
  valueRef.current = value;
  unitRef.current = unit;
  onChangeRef.current = onChange;
  attachmentRef.current = attachment;

  const stepBy = useCallback((delta: number) => {
    const step = MANUAL_STEP[unitRef.current];
    const next = round2(Math.max(0, valueRef.current + delta * step));
    if (next !== valueRef.current) onChangeRef.current(next);
  }, []);

  const attach = useCallback((pivot: THREE.Group) => {
    const api = createCableAttachmentSet();
    api.show(attachmentRef.current);
    apiRef.current = api;
    pivot.add(api.root);
    fitRef.current();
    return () => {
      pivot.remove(api.root);
      api.dispose();
      if (apiRef.current === api) apiRef.current = null;
    };
  }, []);

  const { hostRef, fit, pointer } = useWeightStage({
    attach,
    mode: "fixed",
    pose: CABLE_CAM,
    onStep: stepBy,
    stepAxis: "y",
    live,
    symmetricLights: true,
  });
  fitRef.current = fit;

  useEffect(() => {
    apiRef.current?.show(attachment);
    fit();
  }, [attachment, fit]);

  return (
    <div
      ref={hostRef}
      className={`${STAGE} cursor-ns-resize`}
      style={{ touchAction: "none" }}
      role="img"
      aria-label={`${cableAttachmentLabel(attachment)} cable attachment`}
      data-cable-attachment={attachment}
      {...pointer}
    />
  );
}
