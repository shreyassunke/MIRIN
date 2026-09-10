import { useRef, type PointerEvent as ReactPointerEvent } from "react";

/** Far enough to be a deliberate flick, short enough for one thumb. */
const THRESHOLD_PX = 40;

interface Track {
  id: number;
  x: number;
  y: number;
  /** Cleared once the gesture reads as a vertical scroll instead. */
  live: boolean;
}

export interface SwipeHandlers {
  onPointerDown: (event: ReactPointerEvent) => void;
  onPointerMove: (event: ReactPointerEvent) => void;
  onPointerUp: (event: ReactPointerEvent) => void;
  onPointerCancel: (event: ReactPointerEvent) => void;
}

/**
 * Horizontal swipe for touch and pen only. Mouse is left alone so hover and
 * chart tooltips keep working; desktop gets the same moves from the rail and
 * arrow keys. Nothing is ever prevented or captured, so a vertical drag stays
 * a page scroll.
 */
export function useSwipe({
  onPrev,
  onNext,
  enabled = true,
}: {
  onPrev: () => void;
  onNext: () => void;
  enabled?: boolean;
}): SwipeHandlers {
  const track = useRef<Track | null>(null);

  const end = (event: ReactPointerEvent, commit: boolean) => {
    const current = track.current;
    if (!current || current.id !== event.pointerId) return;
    track.current = null;
    if (!commit || !current.live) return;
    const dx = event.clientX - current.x;
    if (Math.abs(dx) < THRESHOLD_PX) return;
    if (dx < 0) onNext();
    else onPrev();
  };

  return {
    onPointerDown: (event) => {
      if (!enabled || event.pointerType === "mouse") return;
      track.current = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        live: true,
      };
    },
    onPointerMove: (event) => {
      const current = track.current;
      if (!current || current.id !== event.pointerId || !current.live) return;
      const dx = Math.abs(event.clientX - current.x);
      const dy = Math.abs(event.clientY - current.y);
      // Vertical intent wins outright: the page is taller than the chart.
      if (dy > dx && dy > 8) current.live = false;
    },
    onPointerUp: (event) => end(event, true),
    onPointerCancel: (event) => end(event, false),
  };
}
