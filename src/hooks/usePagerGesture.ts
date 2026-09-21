import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

const LOCK_PX = 12;
const SETTLE_MS = 380;
const FLICK_PX_MS = 0.42;
const COMMIT_RATIO = 0.28;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** cubic-bezier(0.16, 1, 0.3, 1) — the project's ease-out-expo. */
function easeOutExpo(x: number) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let t = x;
  for (let i = 0; i < 6; i++) {
    const xEst =
      3 * (1 - t) * (1 - t) * t * 0.16 + 3 * (1 - t) * t * t * 0.3 + t * t * t;
    const dx =
      3 * (1 - t) * (1 - t) * 0.16 +
      6 * (1 - t) * t * (0.3 - 0.16) +
      3 * t * t * 0.7;
    if (Math.abs(xEst - x) < 1e-4 || Math.abs(dx) < 1e-6) break;
    t = Math.max(0, Math.min(1, t - (xEst - x) / dx));
  }
  return (
    3 * (1 - t) * (1 - t) * t * 1 + 3 * (1 - t) * t * t * 1 + t * t * t
  );
}

function rubberband(offset: number, dim: number) {
  if (dim <= 0) return 0;
  const limit = dim * 0.55;
  const x = Math.abs(offset);
  return Math.sign(offset) * (1 - 1 / (x / limit + 1)) * limit;
}

function pointerCapturedByChild(root: HTMLElement, event: PointerEvent) {
  for (const node of event.composedPath()) {
    if (node === root) break;
    if (node instanceof HTMLElement && node.hasPointerCapture(event.pointerId)) {
      return true;
    }
  }
  return false;
}

function canScrollNestedX(root: HTMLElement, start: EventTarget | null, dx: number) {
  let node = start instanceof HTMLElement ? start : null;
  while (node && node !== root) {
    const style = window.getComputedStyle(node);
    const overflowX = style.overflowX;
    if (
      (overflowX === "auto" || overflowX === "scroll") &&
      node.scrollWidth > node.clientWidth + 1
    ) {
      const max = node.scrollWidth - node.clientWidth;
      if ((dx < 0 && node.scrollLeft < max - 1) || (dx > 0 && node.scrollLeft > 1)) {
        return true;
      }
    }
    node = node.parentElement;
  }
  return false;
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export interface PagerGesture {
  onPointerDown: (event: ReactPointerEvent) => void;
  onPointerMove: (event: ReactPointerEvent) => void;
  onPointerUp: (event: ReactPointerEvent) => void;
  onPointerCancel: (event: ReactPointerEvent) => void;
  goTo: (index: number, animate?: boolean) => void;
}

/**
 * Finger-tracked horizontal paging. 1:1 while the pointer is down, rubber-band
 * at the ends, velocity snap on release. Paints through `onProgress` so the
 * track can move without a React render on every frame.
 */
export function usePagerGesture({
  count,
  index,
  enabled = true,
  rootRef,
  onProgress,
  onIndexChange,
}: {
  count: number;
  index: number;
  enabled?: boolean;
  rootRef: RefObject<HTMLElement | null>;
  onProgress: (progress: number, dragging: boolean) => void;
  onIndexChange: (index: number) => void;
}): PagerGesture {
  const progress = useRef(index);
  const dragging = useRef(false);
  const settle = useRef<number | null>(null);
  const indexRef = useRef(index);
  const countRef = useRef(count);
  const onProgressRef = useRef(onProgress);
  const onIndexRef = useRef(onIndexChange);
  indexRef.current = index;
  countRef.current = count;
  onProgressRef.current = onProgress;
  onIndexRef.current = onIndexChange;

  const track = useRef<{
    id: number;
    x: number;
    y: number;
    origin: number;
    lastX: number;
    lastT: number;
    vx: number;
    locked: boolean;
    width: number;
  } | null>(null);

  const paint = useCallback((value: number, isDragging: boolean) => {
    progress.current = value;
    onProgressRef.current(value, isDragging);
  }, []);

  const stopSettle = useCallback(() => {
    if (settle.current != null) {
      cancelAnimationFrame(settle.current);
      settle.current = null;
    }
  }, []);

  const settleTo = useCallback(
    (target: number, animate: boolean) => {
      stopSettle();
      const max = Math.max(0, countRef.current - 1);
      const next = Math.max(0, Math.min(max, target));
      const from = progress.current;
      const reduced = prefersReducedMotion();
      if (!animate || reduced || Math.abs(next - from) < 0.001) {
        paint(next, false);
        if (next !== indexRef.current) onIndexRef.current(next);
        return;
      }
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / SETTLE_MS);
        paint(from + (next - from) * easeOutExpo(t), false);
        if (t < 1) {
          settle.current = requestAnimationFrame(tick);
          return;
        }
        settle.current = null;
        if (next !== indexRef.current) onIndexRef.current(next);
      };
      settle.current = requestAnimationFrame(tick);
    },
    [paint, stopSettle],
  );

  const goTo = useCallback(
    (next: number, animate = true) => {
      dragging.current = false;
      track.current = null;
      settleTo(next, animate);
    },
    [settleTo],
  );

  useEffect(() => {
    if (dragging.current || settle.current != null) return;
    if (Math.abs(progress.current - index) < 0.001) return;
    paint(index, false);
  }, [index, paint]);

  useEffect(() => () => stopSettle(), [stopSettle]);

  const end = (event: ReactPointerEvent, commit: boolean) => {
    const current = track.current;
    if (!current || current.id !== event.pointerId) return;
    track.current = null;
    const root = rootRef.current;
    if (root?.hasPointerCapture(event.pointerId)) {
      root.releasePointerCapture(event.pointerId);
    }
    dragging.current = false;
    if (!commit || !current.locked) {
      settleTo(indexRef.current, true);
      return;
    }
    const raw = event.clientX - current.x;
    const atStart = indexRef.current <= 0 && raw > 0;
    const atEnd = indexRef.current >= countRef.current - 1 && raw < 0;
    const travel = atStart || atEnd ? rubberband(raw, current.width) : raw;
    const flick = current.vx;
    let target = indexRef.current;
    if (flick < -FLICK_PX_MS && raw < 0) target += 1;
    else if (flick > FLICK_PX_MS && raw > 0) target -= 1;
    else if (travel <= -current.width * COMMIT_RATIO) target += 1;
    else if (travel >= current.width * COMMIT_RATIO) target -= 1;
    settleTo(target, true);
  };

  return {
    onPointerDown: (event) => {
      if (!enabled || count < 2 || event.button !== 0) return;
      if (isTypingTarget(event.target)) return;
      stopSettle();
      const root = rootRef.current;
      const width = root?.getBoundingClientRect().width ?? 1;
      track.current = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        origin: progress.current,
        lastX: event.clientX,
        lastT: event.timeStamp,
        vx: 0,
        locked: false,
        width: Math.max(width, 1),
      };
    },
    onPointerMove: (event) => {
      const current = track.current;
      const root = rootRef.current;
      if (!current || !root || current.id !== event.pointerId) return;
      if (pointerCapturedByChild(root, event.nativeEvent)) {
        track.current = null;
        dragging.current = false;
        return;
      }
      const dx = event.clientX - current.x;
      const dy = event.clientY - current.y;
      if (!current.locked) {
        if (Math.hypot(dx, dy) < LOCK_PX) return;
        if (Math.abs(dx) <= Math.abs(dy)) {
          track.current = null;
          return;
        }
        if (canScrollNestedX(root, event.target, dx)) {
          track.current = null;
          return;
        }
        current.locked = true;
        dragging.current = true;
        root.setPointerCapture(event.pointerId);
      }
      const dt = event.timeStamp - current.lastT;
      if (dt > 0) {
        current.vx = (event.clientX - current.lastX) / dt;
        current.lastX = event.clientX;
        current.lastT = event.timeStamp;
      }
      const max = Math.max(0, countRef.current - 1);
      const raw = dx;
      const unclamped = current.origin - raw / current.width;
      let next = unclamped;
      if (unclamped < 0) {
        next = rubberband(unclamped * current.width, current.width) / current.width;
      } else if (unclamped > max) {
        const over = (unclamped - max) * current.width;
        next = max + rubberband(over, current.width) / current.width;
      }
      if (prefersReducedMotion()) {
        paint(current.origin, true);
        return;
      }
      paint(next, true);
    },
    onPointerUp: (event) => end(event, true),
    onPointerCancel: (event) => end(event, false),
    goTo,
  };
}
