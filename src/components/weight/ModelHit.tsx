import { useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { isVariationTap, MODEL_TAP_PX } from "./modelTap";

/** The model (or the stand-in well) that opens the variation list. */
export interface VariationHit {
  label: string;
  expanded: boolean;
  controls?: string;
  live?: boolean;
  onToggle: () => void;
}

/**
 * Tap target painted on an instrument. A short press toggles the variation
 * list. A sideways move still belongs to the exercise pager, so the press
 * scale lets go as soon as the gesture is no longer a tap.
 */
export function ModelHit({
  hit,
  children,
}: {
  hit: VariationHit;
  children: ReactNode;
}) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const live = hit.live ?? true;

  function setPressed(event: PointerEvent<HTMLDivElement>, pressed: boolean) {
    if (pressed) event.currentTarget.dataset.pressed = "";
    else delete event.currentTarget.dataset.pressed;
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!live || event.button !== 0) return;
    start.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    setPressed(event, true);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const origin = start.current;
    if (!origin || origin.id !== event.pointerId) return;
    const travel = Math.hypot(event.clientX - origin.x, event.clientY - origin.y);
    if (travel > MODEL_TAP_PX || event.currentTarget.closest(".is-paging")) {
      setPressed(event, false);
    }
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const origin = start.current;
    start.current = null;
    setPressed(event, false);
    if (!live || !origin || origin.id !== event.pointerId) return;
    const paging = Boolean(event.currentTarget.closest(".is-paging"));
    const travel = Math.hypot(event.clientX - origin.x, event.clientY - origin.y);
    if (!isVariationTap(travel, paging)) return;
    hit.onToggle();
  }

  function onPointerCancel(event: PointerEvent<HTMLDivElement>) {
    start.current = null;
    setPressed(event, false);
  }

  function onPointerLeave(event: PointerEvent<HTMLDivElement>) {
    setPressed(event, false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!live || event.repeat) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    hit.onToggle();
  }

  return (
    <div
      data-variation-trigger=""
      role="button"
      tabIndex={live ? 0 : -1}
      aria-label={hit.label}
      aria-haspopup="listbox"
      aria-expanded={hit.expanded}
      aria-controls={hit.expanded ? hit.controls : undefined}
      className="variation-model"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerLeave}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  );
}
