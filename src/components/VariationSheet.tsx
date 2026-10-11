import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  Fragment,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import type { VariationChoice } from "../lib/variations";

interface VariationSheetProps {
  anchorRef: RefObject<HTMLElement | null>;
  label: string;
  options: VariationChoice[];
  currentId: string | null;
  onPick: (choice: VariationChoice) => void;
  onClose: () => void;
  children?: ReactNode;
}

const VIEW_PAD = 8;

function Check() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M5 12.5 9.5 17 19 7.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The variation list, painted over the instrument. A tap on the model opens
 * it; picking a row applies that implement and closes.
 */
export function VariationSheet({
  anchorRef,
  label,
  options,
  currentId,
  onPick,
  onClose,
  children,
}: VariationSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [box, setBox] = useState({ top: 0, left: 0, width: 280, maxHeight: 360 });

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = Math.max(220, rect.width);
    const left = Math.min(
      Math.max(VIEW_PAD, rect.left),
      window.innerWidth - width - VIEW_PAD,
    );
    const top = Math.max(VIEW_PAD, rect.top);
    const maxHeight = Math.max(160, window.innerHeight - top - VIEW_PAD);
    setBox({ top, left, width, maxHeight });
  }, [anchorRef]);

  useLayoutEffect(() => {
    place();
  }, [place, options.length]);

  // The tap that opened the sheet is followed by a click in the same turn.
  // Swallow that click, then drop the guard before the next frame so a real
  // pick still lands.
  useLayoutEffect(() => {
    const stop = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };
    document.addEventListener("click", stop, true);
    const frame = requestAnimationFrame(() => {
      document.removeEventListener("click", stop, true);
    });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("click", stop, true);
    };
  }, []);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose, place]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (sheetRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [onClose]);

  useEffect(() => {
    const current = options.findIndex((option) => option.id === currentId);
    const index = current >= 0 ? current : 0;
    itemRefs.current[index]?.focus();
  }, [currentId, options]);

  function focusItem(delta: number) {
    const current = itemRefs.current.findIndex((el) => el === document.activeElement);
    const next = (current + delta + options.length) % options.length;
    itemRefs.current[next]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      itemRefs.current[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      itemRefs.current[options.length - 1]?.focus();
    }
  }

  return createPortal(
    <div
      ref={sheetRef}
      role="listbox"
      aria-label={label}
      data-no-pager=""
      data-no-drag=""
      onKeyDown={onKeyDown}
      style={{
        top: box.top,
        left: box.left,
        width: box.width,
        maxHeight: box.maxHeight,
      }}
      className="overflow-menu fixed z-50 flex flex-col overflow-y-auto rounded-xl p-1.5 shadow-glass glass"
    >
      {options.map((option, index) => {
        const selected = option.id === currentId;
        return (
          <Fragment key={option.id}>
          <button
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            type="button"
            role="option"
            aria-selected={selected}
            onClick={() => {
              if (selected) onClose();
              else onPick(option);
            }}
            className={[
              "flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-[15px] font-medium text-ink",
              "transition-colors duration-150 motion-reduce:transition-none",
              selected ? "bg-wash" : "hover:bg-wash",
            ].join(" ")}
          >
            <span className="min-w-0 flex-1">{option.label}</span>
            {selected ? (
              <span className="text-muted">
                <Check />
              </span>
            ) : (
              <span className="h-5 w-5 shrink-0" aria-hidden="true" />
            )}
          </button>
          {option.id === "machine" ? children : null}
          </Fragment>
        );
      })}
    </div>,
    document.body,
  );
}

/** The tap target when an exercise has no instrument to tap. */
export function VariationWell({
  label,
  onEdit,
}: {
  label: string;
  onEdit: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className="glass-btn mx-auto flex h-12 w-full max-w-xs items-center justify-center rounded-md px-3 text-[15px] font-medium text-ink"
    >
      {label}
    </button>
  );
}
