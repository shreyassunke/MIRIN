import {
  useCallback,
  useRef,
  useState,
  type PointerEvent,
} from "react";

interface UseDragReorderOptions {
  enabled?: boolean;
  /** When true, drag only starts from the handle returned by getHandleProps. */
  handleOnly?: boolean;
  onReorder: (from: number, to: number) => void;
}

const REORDER_ATTR = "data-reorder-index";

function indexAtY(y: number): number | null {
  const rows = document.querySelectorAll<HTMLElement>(`[${REORDER_ATTR}]`);
  for (const row of rows) {
    const rect = row.getBoundingClientRect();
    if (y >= rect.top && y <= rect.bottom) {
      const index = Number(row.getAttribute(REORDER_ATTR));
      return Number.isInteger(index) ? index : null;
    }
  }
  return null;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return Boolean(
    (target as HTMLElement | null)?.closest(
      "button, a, input, textarea, select, [role='button']",
    ),
  );
}

export function useDragReorder({
  enabled = true,
  handleOnly = false,
  onReorder,
}: UseDragReorderOptions) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const draggingRef = useRef(false);
  const fromRef = useRef<number | null>(null);
  const overRef = useRef<number | null>(null);

  const reset = useCallback(() => {
    draggingRef.current = false;
    fromRef.current = null;
    overRef.current = null;
    setDragIndex(null);
    setOverIndex(null);
  }, []);

  const updateOverIndex = useCallback((index: number) => {
    overRef.current = index;
    setOverIndex(index);
  }, []);

  const beginDrag = useCallback(
    (index: number, e: PointerEvent) => {
      if (!enabled) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      draggingRef.current = true;
      fromRef.current = index;
      overRef.current = index;
      setDragIndex(index);
      setOverIndex(index);
    },
    [enabled],
  );

  const moveDrag = useCallback(
    (e: PointerEvent) => {
      if (!draggingRef.current) return;
      const index = indexAtY(e.clientY);
      if (index !== null) updateOverIndex(index);
    },
    [updateOverIndex],
  );

  const endDrag = useCallback(
    (e: PointerEvent) => {
      if (!draggingRef.current) return;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      const from = fromRef.current;
      const to = overRef.current;
      if (from !== null && to !== null && from !== to) onReorder(from, to);
      reset();
    },
    [onReorder, reset],
  );

  const cancelDrag = useCallback(() => {
    if (!draggingRef.current) return;
    reset();
  }, [reset]);

  const pointerHandlers = useCallback(
    () => ({
      onPointerMove: moveDrag,
      onPointerUp: endDrag,
      onPointerCancel: cancelDrag,
    }),
    [cancelDrag, endDrag, moveDrag],
  );

  const getHandleProps = useCallback(
    (index: number) => ({
      onPointerDown: (e: PointerEvent) => beginDrag(index, e),
      ...pointerHandlers(),
    }),
    [beginDrag, pointerHandlers],
  );

  const getItemProps = useCallback(
    (index: number) => {
      const isDragTarget = overIndex === index && dragIndex !== null;
      const handlers = pointerHandlers();
      return {
        [REORDER_ATTR]: index,
        onPointerDown: handleOnly
          ? undefined
          : (e: PointerEvent) => {
              if (isInteractiveTarget(e.target)) return;
              beginDrag(index, e);
            },
        onPointerMove: handleOnly ? undefined : handlers.onPointerMove,
        onPointerUp: handleOnly ? undefined : handlers.onPointerUp,
        onPointerCancel: handleOnly ? undefined : handlers.onPointerCancel,
        className: [
          dragIndex === index ? "opacity-50" : "",
          isDragTarget ? "bg-surface-raised" : "",
        ]
          .filter(Boolean)
          .join(" "),
      };
    },
    [
      beginDrag,
      dragIndex,
      handleOnly,
      overIndex,
      pointerHandlers,
    ],
  );

  return { dragIndex, overIndex, getItemProps, getHandleProps, reset };
}
