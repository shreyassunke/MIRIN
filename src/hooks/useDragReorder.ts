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
const SCROLL_MAX = 18;

type DragLive = {
  from: number;
  over: number;
  height: number;
  /** Pointer Y when the drag armed / began. */
  startClientY: number;
  startScrollY: number;
  /** Latest pointer Y (viewport). */
  pointerY: number;
  /** Finger follow offset in document space (includes scroll). */
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
  // Explicit no-drag regions (logging controls, search, etc.)
  if (el.closest("[data-no-drag]")) return true;
  // Header surface may be a button but still long-press to reorder.
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
  const movedRef = useRef(false);
  const pressTimerRef = useRef<number | null>(null);
  const originRef = useRef<{ x: number; y: number; index: number } | null>(
    null,
  );
  const pointerIdRef = useRef<number | null>(null);
  const captureElRef = useRef<HTMLElement | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);

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

  const reset = useCallback(() => {
    clearPressTimer();
    stopScrollLoop();
    draggingRef.current = false;
    movedRef.current = false;
    originRef.current = null;
    pointerIdRef.current = null;
    captureElRef.current = null;
    document.documentElement.classList.remove("reorder-active");
    setLiveBoth(null);
  }, [clearPressTimer, setLiveBoth, stopScrollLoop]);

  const beginDrag = useCallback(
    (index: number, clientY: number, el: HTMLElement) => {
      if (!enabled) return;
      const row = el.closest<HTMLElement>(`[${REORDER_ATTR}]`) ?? el;
      const rect = row.getBoundingClientRect();
      draggingRef.current = true;
      movedRef.current = false;
      suppressClickRef.current = true;
      window.getSelection()?.removeAllRanges();
      document.documentElement.classList.add("reorder-active");
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
    [enabled, setLiveBoth],
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
    if (
      over !== current.over ||
      Math.abs(deltaY - current.deltaY) > 0.5
    ) {
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
        if (!origin) return;
        const dx = e.clientX - origin.x;
        const dy = e.clientY - origin.y;
        if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) {
          clearPressTimer();
          originRef.current = null;
        }
        return;
      }

      e.preventDefault();
      updateDrag(e.clientY);
    },
    [clearPressTimer, updateDrag],
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
      originRef.current = null;
      pointerIdRef.current = null;
    },
    [clearPressTimer, endDrag],
  );

  const onPointerCancel = useCallback(() => {
    clearPressTimer();
    if (draggingRef.current) {
      reset();
      suppressClickRef.current = false;
      return;
    }
    originRef.current = null;
    pointerIdRef.current = null;
  }, [clearPressTimer, reset]);

  const armPress = useCallback(
    (index: number, e: ReactPointerEvent, immediate: boolean) => {
      if (!enabled) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;

      clearPressTimer();
      pointerIdRef.current = e.pointerId;
      captureElRef.current = e.currentTarget as HTMLElement;
      originRef.current = { x: e.clientX, y: e.clientY, index };

      try {
        captureElRef.current.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }

      window.getSelection()?.removeAllRanges();

      if (immediate) {
        e.preventDefault();
        beginDrag(index, e.clientY, captureElRef.current);
        return;
      }

      pressTimerRef.current = window.setTimeout(() => {
        pressTimerRef.current = null;
        const origin = originRef.current;
        const el = captureElRef.current;
        if (!origin || !el) return;
        beginDrag(origin.index, origin.y, el);
      }, longPressMs);
    },
    [beginDrag, clearPressTimer, enabled, longPressMs],
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
        touchAction: handleOnly ? undefined : "pan-y",
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
