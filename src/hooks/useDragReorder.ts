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
const MOVE_CANCEL_PX = 10;
const EDGE_PX = 72;
const SCROLL_MAX = 22;

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

/** Imperative transforms — keeps drag at 60fps without React re-renders. */
function paintDrag(live: DragLive) {
  for (const row of rows()) {
    const index = Number(row.getAttribute(REORDER_ATTR));
    if (!Number.isInteger(index)) continue;

    if (index === live.from) {
      row.dataset.reorderDragging = "true";
      row.classList.add("reorder-dragging");
      row.classList.remove("reorder-slot");
      row.style.transition = "none";
      row.style.zIndex = "40";
      row.style.transform = `translate3d(0, ${live.deltaY}px, 0) scale(1.03)`;
      continue;
    }

    const shift = shiftForIndex(index, live.from, live.over, live.height);
    row.dataset.reorderDragging = "false";
    row.classList.remove("reorder-dragging");
    row.classList.toggle(
      "reorder-slot",
      live.over === index && live.from !== index,
    );
    row.style.zIndex = shift !== 0 ? "1" : "";
    row.style.transition = "transform 140ms var(--ease-out-expo)";
    row.style.transform = shift ? `translate3d(0, ${shift}px, 0)` : "";
  }
}

function clearDragPaint() {
  for (const row of rows()) {
    row.dataset.reorderDragging = "false";
    row.classList.remove("reorder-dragging", "reorder-slot");
    row.style.transition = "transform 140ms var(--ease-out-expo)";
    row.style.transform = "";
    row.style.zIndex = "";
  }
}

export function useDragReorder({
  enabled = true,
  handleOnly = false,
  longPressMs = 180,
  onReorder,
}: UseDragReorderOptions) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
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
  const moveRafRef = useRef<number | null>(null);
  const pendingYRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const touchMoveBlockRef = useRef<((e: TouchEvent) => void) | null>(null);

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

  const stopMoveRaf = useCallback(() => {
    if (moveRafRef.current !== null) {
      cancelAnimationFrame(moveRafRef.current);
      moveRafRef.current = null;
    }
    pendingYRef.current = null;
  }, []);

  const stopTouchMoveBlock = useCallback(() => {
    if (touchMoveBlockRef.current) {
      document.removeEventListener("touchmove", touchMoveBlockRef.current);
      touchMoveBlockRef.current = null;
    }
  }, []);

  const startTouchMoveBlock = useCallback(() => {
    if (touchMoveBlockRef.current) return;
    const block = (e: TouchEvent) => {
      if (armingRef.current || draggingRef.current) e.preventDefault();
    };
    touchMoveBlockRef.current = block;
    document.addEventListener("touchmove", block, { passive: false });
  }, []);

  const reset = useCallback(() => {
    clearPressTimer();
    stopScrollLoop();
    stopMoveRaf();
    stopTouchMoveBlock();
    draggingRef.current = false;
    armingRef.current = false;
    movedRef.current = false;
    originRef.current = null;
    pointerIdRef.current = null;
    captureElRef.current = null;
    liveRef.current = null;
    document.documentElement.classList.remove("reorder-active");
    clearDragPaint();
    setDragIndex(null);
  }, [clearPressTimer, stopMoveRaf, stopScrollLoop, stopTouchMoveBlock]);

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

      captureElRef.current = el;
      if (pointerIdRef.current !== null) {
        try {
          el.setPointerCapture(pointerIdRef.current);
        } catch {
          /* ignore */
        }
      }

      const live: DragLive = {
        from: index,
        over: index,
        height: rect.height,
        startClientY: clientY,
        startScrollY: window.scrollY,
        pointerY: clientY,
        deltaY: 0,
      };
      liveRef.current = live;
      paintDrag(live);
      setDragIndex(index);

      if (navigator.vibrate) {
        try {
          navigator.vibrate(8);
        } catch {
          /* ignore */
        }
      }
    },
    [enabled, startTouchMoveBlock],
  );

  const commitPointerY = useCallback((clientY: number) => {
    const current = liveRef.current;
    if (!current || !draggingRef.current) return;

    const over = indexAtY(clientY) ?? current.over;
    const deltaY =
      clientY - current.startClientY + (window.scrollY - current.startScrollY);

    if (over !== current.over || Math.abs(deltaY) > 1) {
      movedRef.current = true;
    }

    current.pointerY = clientY;
    current.over = over;
    current.deltaY = deltaY;
    paintDrag(current);
  }, []);

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
      commitPointerY(current.pointerY);
    }

    scrollRafRef.current = requestAnimationFrame(autoScrollTick);
  }, [commitPointerY]);

  const ensureScrollLoop = useCallback(() => {
    if (scrollRafRef.current === null) {
      scrollRafRef.current = requestAnimationFrame(autoScrollTick);
    }
  }, [autoScrollTick]);

  const scheduleMove = useCallback(
    (clientY: number) => {
      pendingYRef.current = clientY;
      if (moveRafRef.current !== null) return;
      moveRafRef.current = requestAnimationFrame(() => {
        moveRafRef.current = null;
        const y = pendingYRef.current;
        if (y === null) return;
        pendingYRef.current = null;
        commitPointerY(y);
        ensureScrollLoop();
      });
    },
    [commitPointerY, ensureScrollLoop],
  );

  const cancelArm = useCallback(() => {
    clearPressTimer();
    stopTouchMoveBlock();
    armingRef.current = false;
    originRef.current = null;
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
    }, 220);
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
          cancelArm();
          return;
        }
        e.preventDefault();
        return;
      }

      e.preventDefault();
      scheduleMove(e.clientY);
    },
    [cancelArm, scheduleMove],
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
      const isDragging = dragIndex === index;

      // Transforms are painted imperatively while dragging.
      const style: CSSProperties = {
        position: "relative",
        touchAction: handleOnly ? undefined : "none",
        willChange: dragIndex !== null ? "transform" : undefined,
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
        className: isDragging ? "reorder-dragging" : "",
        "aria-grabbed": isDragging || undefined,
      };
    },
    [armPress, dragIndex, handleOnly, pointerHandlers],
  );

  const shouldSuppressClick = useCallback(() => suppressClickRef.current, []);

  return {
    dragIndex,
    overIndex: liveRef.current?.over ?? null,
    isDragging: dragIndex !== null,
    getItemProps,
    getHandleProps,
    shouldSuppressClick,
    reset,
  };
}
