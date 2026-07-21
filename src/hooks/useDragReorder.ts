import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

interface UseDragReorderOptions {
  enabled?: boolean;
  /** When true, drag only starts from the handle returned by getHandleProps. */
  handleOnly?: boolean;
  /** Long-press delay before a card body drag starts (ms). */
  longPressMs?: number;
  onReorder: (from: number, to: number) => void;
}

const REORDER_ATTR = "data-reorder-index";
const MOVE_CANCEL_PX = 12;
const EDGE_PX = 72;
const SCROLL_MAX = 18;

type DragLive = {
  from: number;
  over: number;
  height: number;
  startClientY: number;
  startScrollY: number;
  pointerY: number;
  deltaY: number;
};

function rows(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(`[${REORDER_ATTR}]`),
  );
}

function indexAtY(y: number): number | null {
  const list = rows();
  if (list.length === 0) return null;

  for (const row of list) {
    if (row.dataset.reorderDragging === "true") continue;
    const rect = row.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    if (y < mid) {
      const index = Number(row.getAttribute(REORDER_ATTR));
      return Number.isInteger(index) ? index : null;
    }
  }

  const last = list[list.length - 1];
  const index = Number(last.getAttribute(REORDER_ATTR));
  return Number.isInteger(index) ? index : null;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.closest("[data-no-drag]")) return true;
  if (el.closest("[data-drag-surface]")) return false;
  return Boolean(
    el.closest("button, a, input, textarea, select, [role='button']"),
  );
}

function shiftForIndex(
  index: number,
  from: number,
  over: number,
  height: number,
): number {
  if (from === over) return 0;
  if (from < over && index > from && index <= over) return -height;
  if (from > over && index >= over && index < from) return height;
  return 0;
}

export function useDragReorder({
  enabled = true,
  handleOnly = false,
  longPressMs = 320,
  onReorder,
}: UseDragReorderOptions) {
  const [live, setLive] = useState<DragLive | null>(null);
  const liveRef = useRef<DragLive | null>(null);
  const draggingRef = useRef(false);
  const armingRef = useRef(false);
  const movedRef = useRef(false);
  const pressTimerRef = useRef<number | null>(null);
  const originRef = useRef<{ x: number; y: number; index: number } | null>(
    null,
  );
  const pointerIdRef = useRef<number | null>(null);
  const captureElRef = useRef<HTMLElement | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const touchMoveBlockRef = useRef<((e: TouchEvent) => void) | null>(null);

  const setLiveBoth = useCallback((next: DragLive | null) => {
    liveRef.current = next;
    setLive(next);
  }, []);

  const clearPressTimer = useCallback(() => {
    if (pressTimerRef.current !== null) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }, []);

  const stopScrollLoop = useCallback(() => {
    if (scrollRafRef.current !== null) {
      cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = null;
    }
  }, []);

  const stopTouchMoveBlock = useCallback(() => {
    if (touchMoveBlockRef.current) {
      document.removeEventListener("touchmove", touchMoveBlockRef.current);
      touchMoveBlockRef.current = null;
    }
  }, []);

  /** Non-passive touchmove so iOS can't scroll-steal the long-press / drag. */
  const startTouchMoveBlock = useCallback(() => {
    if (touchMoveBlockRef.current) return;
    const block = (e: TouchEvent) => {
      if (armingRef.current || draggingRef.current) {
        e.preventDefault();
      }
    };
    touchMoveBlockRef.current = block;
    document.addEventListener("touchmove", block, { passive: false });
  }, []);

  const reset = useCallback(() => {
    clearPressTimer();
    stopScrollLoop();
    stopTouchMoveBlock();
    draggingRef.current = false;
    armingRef.current = false;
    movedRef.current = false;
    originRef.current = null;
    pointerIdRef.current = null;
    captureElRef.current = null;
    document.documentElement.classList.remove("reorder-active");
    setLiveBoth(null);
  }, [clearPressTimer, setLiveBoth, stopScrollLoop, stopTouchMoveBlock]);

  const beginDrag = useCallback(
    (index: number, clientY: number, el: HTMLElement) => {
      if (!enabled) return;
      const row = el.closest<HTMLElement>(`[${REORDER_ATTR}]`) ?? el;
      const rect = row.getBoundingClientRect();
      armingRef.current = false;
      draggingRef.current = true;
      movedRef.current = false;
      suppressClickRef.current = true;
      window.getSelection()?.removeAllRanges();
      document.documentElement.classList.add("reorder-active");
      startTouchMoveBlock();

      // Capture only once the drag is real — not during the press wait.
      captureElRef.current = el;
      if (pointerIdRef.current !== null) {
        try {
          el.setPointerCapture(pointerIdRef.current);
        } catch {
          /* ignore */
        }
      }

      setLiveBoth({
        from: index,
        over: index,
        height: rect.height,
        startClientY: clientY,
        startScrollY: window.scrollY,
        pointerY: clientY,
        deltaY: 0,
      });

      if (navigator.vibrate) {
        try {
          navigator.vibrate(12);
        } catch {
          /* ignore */
        }
      }
    },
    [enabled, setLiveBoth, startTouchMoveBlock],
  );

  const autoScrollTick = useCallback(() => {
    const current = liveRef.current;
    if (!current || !draggingRef.current) {
      scrollRafRef.current = null;
      return;
    }

    const y = current.pointerY;
    let dy = 0;
    if (y < EDGE_PX) {
      dy = -SCROLL_MAX * (1 - Math.max(0, y) / EDGE_PX);
    } else if (y > window.innerHeight - EDGE_PX) {
      const t = (y - (window.innerHeight - EDGE_PX)) / EDGE_PX;
      dy = SCROLL_MAX * Math.min(1, Math.max(0, t));
    }

    if (dy !== 0) {
      window.scrollBy(0, dy);
    }

    const over = indexAtY(current.pointerY) ?? current.over;
    const deltaY =
      current.pointerY -
      current.startClientY +
      (window.scrollY - current.startScrollY);
    if (over !== current.over || Math.abs(deltaY - current.deltaY) > 0.5) {
      if (over !== current.over) movedRef.current = true;
      setLiveBoth({ ...current, over, deltaY });
    }

    scrollRafRef.current = requestAnimationFrame(autoScrollTick);
  }, [setLiveBoth]);

  const ensureScrollLoop = useCallback(() => {
    if (scrollRafRef.current === null) {
      scrollRafRef.current = requestAnimationFrame(autoScrollTick);
    }
  }, [autoScrollTick]);

  const updateDrag = useCallback(
    (clientY: number) => {
      const current = liveRef.current;
      if (!current || !draggingRef.current) return;

      const over = indexAtY(clientY) ?? current.over;
      const deltaY =
        clientY - current.startClientY + (window.scrollY - current.startScrollY);
      if (
        Math.abs(clientY - current.pointerY) > 0.5 ||
        over !== current.over ||
        Math.abs(deltaY - current.deltaY) > 0.5
      ) {
        if (over !== current.over || Math.abs(deltaY) > 2) {
          movedRef.current = true;
        }
        setLiveBoth({ ...current, pointerY: clientY, over, deltaY });
      }
      ensureScrollLoop();
    },
    [ensureScrollLoop, setLiveBoth],
  );

  const cancelArm = useCallback(() => {
    clearPressTimer();
    stopTouchMoveBlock();
    armingRef.current = false;
    originRef.current = null;
    // Leave pointerId so pointerup can clean up; do not capture.
  }, [clearPressTimer, stopTouchMoveBlock]);

  const endDrag = useCallback(() => {
    const current = liveRef.current;
    const from = current?.from ?? null;
    const to = current?.over ?? null;
    const didMove =
      movedRef.current && from !== null && to !== null && from !== to;

    if (captureElRef.current && pointerIdRef.current !== null) {
      try {
        if (captureElRef.current.hasPointerCapture(pointerIdRef.current)) {
          captureElRef.current.releasePointerCapture(pointerIdRef.current);
        }
      } catch {
        /* ignore */
      }
    }

    reset();

    if (didMove && from !== null && to !== null) {
      onReorder(from, to);
    }

    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 320);
  }, [onReorder, reset]);

  useEffect(() => () => reset(), [reset]);

  const onPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      if (pointerIdRef.current !== null && e.pointerId !== pointerIdRef.current) {
        return;
      }

      if (!draggingRef.current) {
        const origin = originRef.current;
        if (!origin || !armingRef.current) return;
        const dx = e.clientX - origin.x;
        const dy = e.clientY - origin.y;
        if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) {
          // Finger moved — this is a scroll, not a drag. Release cleanly.
          cancelArm();
          return;
        }
        // Still within slop while waiting for long-press: hold the gesture.
        e.preventDefault();
        return;
      }

      e.preventDefault();
      updateDrag(e.clientY);
    },
    [cancelArm, updateDrag],
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent) => {
      if (pointerIdRef.current !== null && e.pointerId !== pointerIdRef.current) {
        return;
      }
      clearPressTimer();
      if (draggingRef.current) {
        e.preventDefault();
        endDrag();
        return;
      }
      stopTouchMoveBlock();
      armingRef.current = false;
      originRef.current = null;
      pointerIdRef.current = null;
      captureElRef.current = null;
    },
    [clearPressTimer, endDrag, stopTouchMoveBlock],
  );

  const onPointerCancel = useCallback(() => {
    clearPressTimer();
    if (draggingRef.current) {
      reset();
      suppressClickRef.current = false;
      return;
    }
    stopTouchMoveBlock();
    armingRef.current = false;
    originRef.current = null;
    pointerIdRef.current = null;
    captureElRef.current = null;
  }, [clearPressTimer, reset, stopTouchMoveBlock]);

  const armPress = useCallback(
    (index: number, e: ReactPointerEvent, immediate: boolean) => {
      if (!enabled) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;

      clearPressTimer();
      pointerIdRef.current = e.pointerId;
      captureElRef.current = e.currentTarget as HTMLElement;
      originRef.current = { x: e.clientX, y: e.clientY, index };
      window.getSelection()?.removeAllRanges();

      if (immediate) {
        e.preventDefault();
        startTouchMoveBlock();
        beginDrag(index, e.clientY, captureElRef.current);
        return;
      }

      // Arm long-press without capturing yet — capture happens in beginDrag.
      armingRef.current = true;
      startTouchMoveBlock();

      pressTimerRef.current = window.setTimeout(() => {
        pressTimerRef.current = null;
        const origin = originRef.current;
        const el = captureElRef.current;
        if (!origin || !el || !armingRef.current) return;
        beginDrag(origin.index, origin.y, el);
      }, longPressMs);
    },
    [beginDrag, clearPressTimer, enabled, longPressMs, startTouchMoveBlock],
  );

  const pointerHandlers = useCallback(
    () => ({
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    }),
    [onPointerCancel, onPointerMove, onPointerUp],
  );

  const getHandleProps = useCallback(
    (index: number) => ({
      onPointerDown: (e: ReactPointerEvent) => {
        e.stopPropagation();
        armPress(index, e, true);
      },
      ...pointerHandlers(),
    }),
    [armPress, pointerHandlers],
  );

  const getItemProps = useCallback(
    (index: number) => {
      const handlers = pointerHandlers();
      const isDragging = live?.from === index;

      let translateY = 0;
      if (live) {
        translateY = isDragging
          ? live.deltaY
          : shiftForIndex(index, live.from, live.over, live.height);
      }

      const style: CSSProperties = {
        transform: isDragging
          ? `translate3d(0, ${translateY}px, 0) scale(1.03)`
          : translateY
            ? `translate3d(0, ${translateY}px, 0)`
            : undefined,
        transition: isDragging
          ? "box-shadow 160ms var(--ease-out-quint), transform 0ms linear"
          : "transform 220ms var(--ease-out-quint), box-shadow 180ms var(--ease-out-quint)",
        zIndex: isDragging ? 40 : live && translateY !== 0 ? 1 : undefined,
        position: "relative",
        // none: we own vertical gestures on cards so long-press isn't scroll-stolen.
        // Scroll from page chrome / data-no-drag regions instead.
        touchAction: handleOnly ? undefined : "none",
        willChange: live ? "transform" : undefined,
      };

      return {
        [REORDER_ATTR]: index,
        "data-reorder-dragging": isDragging ? "true" : undefined,
        style,
        onPointerDown: handleOnly
          ? undefined
          : (e: ReactPointerEvent) => {
              if (isInteractiveTarget(e.target)) return;
              armPress(index, e, false);
            },
        onPointerMove: handleOnly ? undefined : handlers.onPointerMove,
        onPointerUp: handleOnly ? undefined : handlers.onPointerUp,
        onPointerCancel: handleOnly ? undefined : handlers.onPointerCancel,
        className: [
          isDragging ? "reorder-dragging" : "",
          live && live.over === index && live.from !== index
            ? "reorder-slot"
            : "",
        ]
          .filter(Boolean)
          .join(" "),
        "aria-grabbed": isDragging || undefined,
      };
    },
    [armPress, handleOnly, live, pointerHandlers],
  );

  const shouldSuppressClick = useCallback(() => suppressClickRef.current, []);

  return {
    dragIndex: live?.from ?? null,
    overIndex: live?.over ?? null,
    isDragging: live !== null,
    getItemProps,
    getHandleProps,
    shouldSuppressClick,
    reset,
  };
}
