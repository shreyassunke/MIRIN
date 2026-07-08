import type { PointerEvent } from "react";

interface DragHandleProps {
  onPointerDown?: (e: PointerEvent) => void;
  onPointerMove?: (e: PointerEvent) => void;
  onPointerUp?: (e: PointerEvent) => void;
  onPointerCancel?: (e: PointerEvent) => void;
}

/** Braille grip used for drag-to-reorder rows. */
export function DragHandle({
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: DragHandleProps) {
  return (
    <span
      aria-hidden="true"
      className="flex cursor-grab touch-none select-none items-center px-1 py-3 text-muted active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      ⠿
    </span>
  );
}
