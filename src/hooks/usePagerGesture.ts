import { useCallback, useEffect, useRef, type RefObject } from "react";

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
  return 3 * (1 - t) * (1 - t) * t * 1 + 3 * (1 - t) * t * t * 1 + t * t * t;
}

function rubberband(offset: number, dim: number) {
  if (dim <= 0) return 0;
  const limit = dim * 0.55;
  const x = Math.abs(offset);
  return Math.sign(offset) * (1 - 1 / (x / limit + 1)) * limit;
}

function canScrollNestedX(
  root: HTMLElement,
  start: EventTarget | null,
  dx: number,
) {
  let node = start instanceof HTMLElement ? start : null;
  while (node && node !== root) {
    const style = window.getComputedStyle(node);
    const overflowX = style.overflowX;
    if (
      (overflowX === "auto" || overflowX === "scroll") &&
      node.scrollWidth > node.clientWidth + 1
    ) {
      const max = node.scrollWidth - node.clientWidth;
      if (
        (dx < 0 && node.scrollLeft < max - 1) ||
        (dx > 0 && node.scrollLeft > 1)
      ) {
        return true;
      }
    }
    node = node.parentElement;
  }
  return false;
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest("input, textarea, select, [contenteditable='true']"),
  );
}

type Track = {
  id: number;
  x: number;
  y: number;
  origin: number;
  lastX: number;
  lastT: number;
  vx: number;
  locked: boolean;
  width: number;
};

/**
 * Finger-tracked horizontal paging. Listens in capture phase on the field and
 * on window after pointerdown so a swipe starting on a child (canvas, button,
 * stepper) still drives the page 1:1. Vertical intent is left to scroll / the
 * dumbbell rack.
 */
export function usePagerGesture({
  count,
  index,
  enabled = true,
  rootRef,
  onProgress,
  onIndexChange,
  getWidth,
}: {
  count: number;
  index: number;
  enabled?: boolean;
  rootRef: RefObject<HTMLElement | null>;
  onProgress: (progress: number, dragging: boolean) => void;
  onIndexChange: (index: number) => void;
  getWidth?: () => number;
}): { goTo: (index: number, animate?: boolean) => void } {
  const progress = useRef(index);
  const dragging = useRef(false);
  const settle = useRef<number | null>(null);
  const track = useRef<Track | null>(null);
  const indexRef = useRef(index);
  const countRef = useRef(count);
  const onProgressRef = useRef(onProgress);
  const onIndexRef = useRef(onIndexChange);
  const getWidthRef = useRef(getWidth);
  indexRef.current = index;
  countRef.current = count;
  onProgressRef.current = onProgress;
  onIndexRef.current = onIndexChange;
  getWidthRef.current = getWidth;

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

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !enabled || count < 2) return;

    const releaseCapture = (pointerId: number) => {
      if (root.hasPointerCapture(pointerId)) {
        try {
          root.releasePointerCapture(pointerId);
        } catch {
          /* already released */
        }
      }
    };

    const dropWindow = () => {
      window.removeEventListener("pointermove", onMove, { capture: true });
      window.removeEventListener("pointerup", onUp, { capture: true });
      window.removeEventListener("pointercancel", onCancel, { capture: true });
    };

    const finish = (event: PointerEvent, commit: boolean) => {
      const current = track.current;
      if (!current || current.id !== event.pointerId) return;
      track.current = null;
      dropWindow();
      releaseCapture(event.pointerId);
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

    const onMove = (event: PointerEvent) => {
      const current = track.current;
      if (!current || current.id !== event.pointerId) return;
      const dx = event.clientX - current.x;
      const dy = event.clientY - current.y;

      if (!current.locked) {
        if (Math.hypot(dx, dy) < LOCK_PX) return;
        if (Math.abs(dx) <= Math.abs(dy)) {
          track.current = null;
          dropWindow();
          return;
        }
        if (canScrollNestedX(root, event.target, dx)) {
          track.current = null;
          dropWindow();
          return;
        }
        current.locked = true;
        dragging.current = true;
        try {
          root.setPointerCapture(event.pointerId);
        } catch {
          /* capture is best-effort; window listeners still drive the drag */
        }
        if (event.cancelable) event.preventDefault();
      }

      if (event.cancelable) event.preventDefault();
      const dt = event.timeStamp - current.lastT;
      if (dt > 0) {
        current.vx = (event.clientX - current.lastX) / dt;
        current.lastX = event.clientX;
        current.lastT = event.timeStamp;
      }
      const max = Math.max(0, countRef.current - 1);
      const unclamped = current.origin - dx / current.width;
      let next = unclamped;
      if (unclamped < 0) {
        next =
          rubberband(unclamped * current.width, current.width) / current.width;
      } else if (unclamped > max) {
        const over = (unclamped - max) * current.width;
        next = max + rubberband(over, current.width) / current.width;
      }
      if (prefersReducedMotion()) {
        paint(current.origin, true);
        return;
      }
      paint(next, true);
    };

    const onUp = (event: PointerEvent) => finish(event, true);
    const onCancel = (event: PointerEvent) => finish(event, false);

    const onDown = (event: PointerEvent) => {
      if (!event.isPrimary) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (isTypingTarget(event.target)) return;
      stopSettle();
      const width =
        getWidthRef.current?.() ?? root.getBoundingClientRect().width;
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
      window.addEventListener("pointermove", onMove, {
        capture: true,
        passive: false,
      });
      window.addEventListener("pointerup", onUp, { capture: true });
      window.addEventListener("pointercancel", onCancel, { capture: true });
    };

    root.addEventListener("pointerdown", onDown, { capture: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.target !== root) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goTo(indexRef.current + 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goTo(indexRef.current - 1);
      }
    };
    root.addEventListener("keydown", onKey);
    return () => {
      root.removeEventListener("pointerdown", onDown, { capture: true });
      root.removeEventListener("keydown", onKey);
      dropWindow();
      stopSettle();
    };
  }, [count, enabled, goTo, paint, rootRef, settleTo, stopSettle]);

  useEffect(() => () => stopSettle(), [stopSettle]);

  return { goTo };
}
