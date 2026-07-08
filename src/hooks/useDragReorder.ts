import { useCallback, useState, type DragEvent } from "react";

interface UseDragReorderOptions {
  enabled?: boolean;
  onReorder: (from: number, to: number) => void;
}

export function useDragReorder({
  enabled = true,
  onReorder,
}: UseDragReorderOptions) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const reset = useCallback(() => {
    setDragIndex(null);
    setOverIndex(null);
  }, []);

  const getItemProps = useCallback(
    (index: number) => {
      const isDragTarget = overIndex === index && dragIndex !== null;
      return {
        draggable: enabled,
        onDragStart: () => {
          if (!enabled) return;
          setDragIndex(index);
        },
        onDragEnd: reset,
        onDragOver: (e: DragEvent) => {
          if (!enabled) return;
          e.preventDefault();
          setOverIndex(index);
        },
        onDrop: (e: DragEvent) => {
          e.preventDefault();
          if (dragIndex !== null) onReorder(dragIndex, index);
          reset();
        },
        className: [
          dragIndex === index ? "opacity-50" : "",
          isDragTarget ? "bg-surface-raised" : "",
        ]
          .filter(Boolean)
          .join(" "),
      };
    },
    [dragIndex, enabled, onReorder, overIndex, reset],
  );

  return { dragIndex, overIndex, getItemProps, reset };
}
