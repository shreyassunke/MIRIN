import { useCallback, useEffect, useRef, type RefObject } from "react";

const LOCK_PX = 8;
const SETTLE_MS = 300;
const FLICK_PX_MS = 0.35;
const STALE_VX_MS = 80;

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

function isExemptTarget(target: EventTarget | null, pageClaim: boolean) {
  if (!(target instanceof Element)) return false;
  if (target.closest("input, textarea, select, [contenteditable='true']")) {
    return true;
  }
  if (pageClaim) return false;
  return Boolean(target.closest("[data-no-pager]"));
}

/** Snap from the finger's current page, not the down-point. Flick wins. */
export function commitIndex(progress: number, vx: number, count: number) {
  const max = Math.max(0, count - 1);
  if (count < 2) return 0;
  if (vx < -FLICK_PX_MS) {
    return Math.min(max, Math.floor(progress + 1e-3) + 1);
  }
  if (vx > FLICK_PX_MS) {
    return Math.max(0, Math.ceil(progress - 1e-3) - 1);
  }
  return Math.max(0, Math.min(max, Math.round(progress)));
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
 * Finger-tracked horizontal paging. Document listeners own the drag — never
 * pointer capture, so a WebGL canvas cannot cancel the swipe. Vertical intent
 * still scrolls the page. `claim: "page"` starts from any child except fields.
 */
export function usePagerGesture({
  count,
  index,
  enabled = true,
  rootRef,
  onProgress,
  onIndexChange,
  getWidth,
  claim = "controls",
}: {
  count: number;
  index: number;
  enabled?: boolean;
  rootRef: RefObject<HTMLElement | null>;
  onProgress: (progress: number, dragging: boolean) => void;
  onIndexChange: (index: number) => void;
  getWidth?: () => number;
  /** `page` claims every horizontal drag; `controls` honors `[data-no-pager]`. */
  claim?: "controls" | "page";
}): { goTo: (index: number, animate?: boolean) => void } {
  const progress = useRef(index);
  const dragging = useRef(false);
  const settle = useRef<number | null>(null);
  const paintRaf = useRef<number | null>(null);
  const track = useRef<Track | null>(null);
  const indexRef = useRef(index);
  const countRef = useRef(count);
  const onProgressRef = useRef(onProgress);
  const onIndexRef = useRef(onIndexChange);
  const getWidthRef = useRef(getWidth);
  const claimRef = useRef(claim);
  const suppressClick = useRef(false);
  indexRef.current = index;
  countRef.current = count;
  onProgressRef.current = onProgress;
  onIndexRef.current = onIndexChange;
  getWidthRef.current = getWidth;
  claimRef.current = claim;

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

  const stopPaintRaf = useCallback(() => {
    if (paintRaf.current != null) {
      cancelAnimationFrame(paintRaf.current);
      paintRaf.current = null;
    }
  }, []);

  const settleTo = useCallback(
    (target: number, animate: boolean) => {
      stopSettle();
      stopPaintRaf();
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
        paint(next, false);
        if (next !== indexRef.current) onIndexRef.current(next);
      };
      settle.current = requestAnimationFrame(tick);
    },
    [paint, stopPaintRaf, stopSettle],
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
    settleTo(index, true);
  }, [index, settleTo]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !enabled || count < 2) return;

    const pageClaim = () => claimRef.current === "page";

    const dropWindow = () => {
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("pointercancel", onCancel, true);
    };

    const clampedFromFinger = (current: Track, clientX: number) => {
      const dx = clientX - current.x;
      const max = Math.max(0, countRef.current - 1);
      const unclamped = current.origin - dx / current.width;
      if (unclamped < 0) {
        return rubberband(unclamped * current.width, current.width) / current.width;
      }
      if (unclamped > max) {
        const over = (unclamped - max) * current.width;
        return max + rubberband(over, current.width) / current.width;
      }
      return unclamped;
    };

    const finish = (event: PointerEvent, commit: boolean) => {
      const current = track.current;
      if (!current || current.id !== event.pointerId) return;
      track.current = null;
      dropWindow();
      dragging.current = false;
      stopPaintRaf();

      if (!commit || !current.locked) {
        settleTo(Math.round(progress.current), true);
        return;
      }

      const vx =
        event.timeStamp - current.lastT > STALE_VX_MS ? 0 : current.vx;
      const next = prefersReducedMotion()
        ? commitIndex(current.origin, 0, countRef.current)
        : commitIndex(progress.current, vx, countRef.current);
      settleTo(next, true);
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
        if (!pageClaim() && canScrollNestedX(root, event.target, dx)) {
          track.current = null;
          dropWindow();
          return;
        }
        current.locked = true;
        dragging.current = true;
        suppressClick.current = true;
        if (event.cancelable) event.preventDefault();
        paint(clampedFromFinger(current, event.clientX), true);
      }

      if (event.cancelable) event.preventDefault();
      const dt = event.timeStamp - current.lastT;
      if (dt > 0 && dt < 100) {
        current.vx = (event.clientX - current.lastX) / dt;
        current.lastX = event.clientX;
        current.lastT = event.timeStamp;
      } else if (dt >= 100) {
        current.vx = 0;
        current.lastX = event.clientX;
        current.lastT = event.timeStamp;
      }

      const next = prefersReducedMotion()
        ? current.origin
        : clampedFromFinger(current, event.clientX);
      progress.current = next;
      if (paintRaf.current == null) {
        paintRaf.current = requestAnimationFrame(() => {
          paintRaf.current = null;
          if (!track.current) return;
          paint(progress.current, true);
        });
      }
    };

    const onUp = (event: PointerEvent) => finish(event, true);
    const onCancel = (event: PointerEvent) => finish(event, false);

    const abort = () => {
      const current = track.current;
      if (!current) {
        if (dragging.current) {
          dragging.current = false;
          settleTo(Math.round(progress.current), true);
        }
        return;
      }
      track.current = null;
      dropWindow();
      dragging.current = false;
      stopPaintRaf();
      settleTo(Math.round(progress.current), true);
    };

    const onDown = (event: PointerEvent) => {
      if (!event.isPrimary) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (isExemptTarget(event.target, pageClaim())) return;
      stopSettle();
      stopPaintRaf();
      const width =
        getWidthRef.current?.() ?? root.getBoundingClientRect().width;
      if (width < 8) return;
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
      document.addEventListener("pointermove", onMove, {
        capture: true,
        passive: false,
      });
      document.addEventListener("pointerup", onUp, { capture: true });
      document.addEventListener("pointercancel", onCancel, { capture: true });
    };

    const onKey = (event: KeyboardEvent) => {
      if (!(event.target instanceof Node) || !root.contains(event.target)) {
        return;
      }
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goTo(indexRef.current + 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goTo(indexRef.current - 1);
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!dragging.current) return;
      if (event.cancelable) event.preventDefault();
    };

    const onClick = (event: MouseEvent) => {
      if (!suppressClick.current) return;
      event.preventDefault();
      event.stopPropagation();
      suppressClick.current = false;
    };

    root.addEventListener("pointerdown", onDown, { capture: true });
    root.addEventListener("keydown", onKey);
    root.addEventListener("click", onClick, true);
    document.addEventListener("touchmove", onTouchMove, {
      capture: true,
      passive: false,
    });
    const onHidden = () => {
      if (document.visibilityState === "hidden") abort();
    };
    window.addEventListener("blur", abort);
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", abort);
    return () => {
      root.removeEventListener("pointerdown", onDown, { capture: true });
      root.removeEventListener("keydown", onKey);
      root.removeEventListener("click", onClick, true);
      document.removeEventListener("touchmove", onTouchMove, true);
      window.removeEventListener("blur", abort);
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", abort);
      dropWindow();
      stopPaintRaf();
      stopSettle();
    };
  }, [count, enabled, goTo, paint, rootRef, settleTo, stopPaintRaf, stopSettle]);

  useEffect(() => () => stopSettle(), [stopSettle]);

  return { goTo };
}
