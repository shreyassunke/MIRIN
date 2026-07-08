import type { PointerEvent } from "react";

interface DragHandleProps {
  onPointerDown?: (e: PointerEvent) => void;
}

/** Braille grip used for drag-to-reorder rows. */
export function DragHandle({ onPointerDown }: DragHandleProps) {
  return (
    <span
      aria-hidden="true"
      className="cursor-grab select-none text-muted"
      onPointerDown={onPointerDown}
    >
      ⠿
    </span>
  );
}
