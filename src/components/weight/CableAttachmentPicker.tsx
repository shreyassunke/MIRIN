import { lazy, Suspense } from "react";
import {
  CABLE_ATTACHMENTS,
  type CableAttachmentId,
} from "../../lib/cableAttachment";
import type { Unit } from "../../lib/units";
import { ChunkErrorBoundary, hasWebGL } from "./three/fallback";

const STAGE = "mx-auto h-52 w-full max-w-sm";

const loadCableAttachment3D = () =>
  import("./three/CableAttachment3D").then((m) => ({
    default: m.CableAttachment3D,
  }));
const CableAttachment3D = lazy(loadCableAttachment3D);
void loadCableAttachment3D();

interface CableAttachmentPickerProps {
  attachment: CableAttachmentId;
  unit: Unit;
  value: number;
  onChange: (value: number) => void;
  onAttachment: (id: CableAttachmentId) => void;
  live?: boolean;
}

export function CableAttachmentPicker({
  attachment,
  unit,
  value,
  onChange,
  onAttachment,
  live = true,
}: CableAttachmentPickerProps) {
  const stage = hasWebGL() ? (
    <ChunkErrorBoundary
      fallback={<div className={STAGE} data-cable-attachment={attachment} aria-hidden="true" />}
    >
      <Suspense
        fallback={<div className={STAGE} data-cable-attachment={attachment} aria-hidden="true" />}
      >
        <CableAttachment3D
          attachment={attachment}
          unit={unit}
          value={value}
          onChange={onChange}
          live={live}
        />
      </Suspense>
    </ChunkErrorBoundary>
  ) : (
    <div className={STAGE} data-cable-attachment={attachment} aria-hidden="true" />
  );

  return (
    <div className="flex flex-col">
      {stage}
      <div
        role="radiogroup"
        aria-label="Cable attachment"
        data-no-pager=""
        className="flex flex-wrap items-center justify-center"
      >
        {CABLE_ATTACHMENTS.map((item) => {
          const selected = item.id === attachment;
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={selected}
              data-no-pager=""
              onClick={() => onAttachment(item.id)}
              className={`min-h-11 px-2 text-[13px] font-medium transition-colors duration-150 ${
                selected ? "text-ink" : "text-muted hover:text-ink"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
