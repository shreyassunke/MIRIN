import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from "react";

const DEFAULT_THRESHOLD_MS = 450;

interface UseLongPressOptions {
  onLongPress: () => void;
  thresholdMs?: number;
  disabled?: boolean;
}

export function useLongPress({
  onLongPress,
  thresholdMs = DEFAULT_THRESHOLD_MS,
  disabled = false,
}: UseLongPressOptions) {
  const [isPressing, setIsPressing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const onPointerDown = useCallback(
    (e: PointerEvent) => {
      if (disabled || e.button !== 0) return;
      firedRef.current = false;
      setIsPressing(true);
      clearTimer();
      timerRef.current = setTimeout(() => {
        firedRef.current = true;
        setIsPressing(false);
        onLongPress();
      }, thresholdMs);
    },
    [clearTimer, disabled, onLongPress, thresholdMs],
  );

  const endPress = useCallback(() => {
    clearTimer();
    setIsPressing(false);
  }, [clearTimer]);

  const onPointerUp = useCallback(() => {
    endPress();
  }, [endPress]);

  const onPointerCancel = useCallback(() => {
    endPress();
  }, [endPress]);

  const onPointerLeave = useCallback(() => {
    if (!firedRef.current) endPress();
  }, [endPress]);

  const onClickCapture = useCallback((e: MouseEvent) => {
    if (firedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      firedRef.current = false;
    }
  }, []);

  return {
    isPressing,
    longPressHandlers: {
      onPointerDown,
      onPointerUp,
      onPointerCancel,
      onPointerLeave,
      onClickCapture,
    },
  };
}
