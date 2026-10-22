import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import type { CableAttachmentId } from "../../../lib/cableAttachment";
import {
  createCableAttachmentSet,
  type CableAttachmentSet,
} from "./createCableAttachment";
import { CABLE_CAM } from "./scale";
import { useWeightStage } from "./useWeightStage";

const STAGE = "weight-stage weight-stage-cable";

interface CableAttachment3DProps {
  attachment: CableAttachmentId;
  live?: boolean;
}

export function CableAttachment3D({
  attachment,
  live = true,
}: CableAttachment3DProps) {
  const attachmentRef = useRef(attachment);
  const apiRef = useRef<CableAttachmentSet | null>(null);
  const fitRef = useRef<() => void>(() => {});
  attachmentRef.current = attachment;

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

  const { hostRef, fit } = useWeightStage({
    attach,
    mode: "fixed",
    pose: CABLE_CAM,
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
      className={STAGE}
      style={{ pointerEvents: "none" }}
      data-cable-attachment={attachment}
      aria-hidden="true"
    />
  );
}
