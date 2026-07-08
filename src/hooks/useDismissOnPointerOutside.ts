import { useEffect, type RefObject } from "react";

/** Calls `onDismiss` when the user taps or clicks outside `ref`. */
export function useDismissOnPointerOutside(
  ref: RefObject<HTMLElement | null>,
  onDismiss: () => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return;

    const handlePointerDown = (event: PointerEvent) => {
      const root = ref.current;
      if (!root || root.contains(event.target as Node)) return;
      onDismiss();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [ref, onDismiss, enabled]);
}
