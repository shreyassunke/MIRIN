import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type SVGProps,
} from "react";
import { createPortal } from "react-dom";
import { REST_PRESETS } from "../lib/exerciseMeta";

export type OverflowItem = {
  id: string;
  label: string;
  icon: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
  onSelect?: () => void;
  panel?: (api: { close: () => void }) => ReactNode;
};

interface ItemOverflowProps {
  label: string;
  items: OverflowItem[];
}

const MENU_WIDTH = 260;
const VIEW_PAD = 8;

function IconEllipsis(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx="12" cy="6" r="1.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <circle cx="12" cy="18" r="1.4" fill="currentColor" />
    </svg>
  );
}

export function ItemOverflow({ label, items }: ItemOverflowProps) {
  const triggerId = useId();
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, origin: "top right" });

  const close = useCallback(() => {
    setOpen(false);
    setExpandedId(null);
  }, []);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;
    const rect = trigger.getBoundingClientRect();
    const menuH = menu.offsetHeight;
    const menuW = Math.max(MENU_WIDTH, menu.offsetWidth);
    let left = rect.right - menuW;
    left = Math.min(
      Math.max(VIEW_PAD, left),
      window.innerWidth - menuW - VIEW_PAD,
    );
    const below = rect.bottom + 6;
    const above = rect.top - menuH - 6;
    const fitsBelow = below + menuH <= window.innerHeight - VIEW_PAD;
    const top = fitsBelow
      ? below
      : Math.max(VIEW_PAD, above);
    setCoords({
      top,
      left,
      origin: fitsBelow ? "top right" : "bottom right",
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
  }, [open, expandedId, items, place]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        triggerRef.current?.focus();
      }
    };
    const onReposition = () => close();
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const first = items.findIndex((item) => !item.disabled);
    if (first < 0) return;
    itemRefs.current[first]?.focus();
  }, [open]);

  function focusItem(delta: number) {
    const enabledIndexes = items
      .map((item, i) => (item.disabled ? -1 : i))
      .filter((i) => i >= 0);
    if (enabledIndexes.length === 0) return;
    const current = itemRefs.current.findIndex(
      (el) => el === document.activeElement,
    );
    const pos = enabledIndexes.indexOf(current);
    const next =
      enabledIndexes[
        (pos + delta + enabledIndexes.length) % enabledIndexes.length
      ];
    itemRefs.current[next]?.focus();
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      const first = items.findIndex((item) => !item.disabled);
      if (first >= 0) itemRefs.current[first]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      for (let i = items.length - 1; i >= 0; i--) {
        if (!items[i].disabled) {
          itemRefs.current[i]?.focus();
          break;
        }
      }
    }
  }

  function activate(item: OverflowItem) {
    if (item.disabled) return;
    if (item.panel) {
      setExpandedId((current) => (current === item.id ? null : item.id));
      return;
    }
    item.onSelect?.();
    close();
  }

  return (
    <div data-no-drag="" className="relative shrink-0 self-center">
      <button
        ref={triggerRef}
        type="button"
        id={triggerId}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close() : setOpen(true))}
        className={[
          "flex h-11 w-11 items-center justify-center bg-transparent",
          "transition-colors duration-150 motion-reduce:transition-none",
          open
            ? "text-muted"
            : "text-ink hover:text-muted active:text-muted",
        ].join(" ")}
      >
        <IconEllipsis className="h-5 w-5" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-labelledby={triggerId}
            onKeyDown={onMenuKeyDown}
            style={{
              top: coords.top,
              left: coords.left,
              width: MENU_WIDTH,
              transformOrigin: coords.origin,
            }}
            className="overflow-menu fixed z-50 rounded-xl p-1.5 shadow-glass glass"
          >
            {items.map((item, index) => (
              <div key={item.id}>
                {item.separatorBefore && (
                  <div
                    role="separator"
                    className="my-1 h-px bg-[rgb(250_250_250/0.1)]"
                  />
                )}
                <button
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => activate(item)}
                  className={[
                    "flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-[15px] font-medium transition-colors duration-150 motion-reduce:transition-none",
                    item.danger
                      ? "text-muted hover:bg-[rgb(250_250_250/0.06)] hover:text-ink"
                      : "text-ink hover:bg-[rgb(250_250_250/0.08)]",
                    item.disabled ? "pointer-events-none opacity-40" : "",
                    expandedId === item.id
                      ? "bg-[rgb(250_250_250/0.08)]"
                      : "",
                  ].join(" ")}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center text-muted">
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </button>
                {expandedId === item.id && item.panel
                  ? item.panel({ close })
                  : null}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

const iconClass = "h-5 w-5";
const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconNote(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} aria-hidden="true" {...props}>
      <path d="M7 4.5h10A1.5 1.5 0 0 1 18.5 6v14L12 17.5 5.5 20V6A1.5 1.5 0 0 1 7 4.5Z" {...stroke} />
    </svg>
  );
}

export function IconSticky(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} aria-hidden="true" {...props}>
      <path d="M6.5 5.5h11v9.2L13.7 18.5H6.5V5.5Z" {...stroke} />
      <path d="M13.7 18.5v-3.8h3.8" {...stroke} />
    </svg>
  );
}

export function IconWarmup(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} aria-hidden="true" {...props}>
      <path d="M6 17.5h3.5V14H6v3.5ZM10.25 17.5h3.5V10h-3.5v7.5ZM14.5 17.5H18V6.5h-3.5v11Z" {...stroke} />
    </svg>
  );
}

export function IconRest(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="7.25" {...stroke} />
      <path d="M12 8.5V12l2.5 1.75" {...stroke} />
    </svg>
  );
}

export function IconReplace(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} aria-hidden="true" {...props}>
      <path d="M7.5 8.5h9l-2.25-2.25M16.5 15.5h-9l2.25 2.25" {...stroke} />
    </svg>
  );
}

export function IconSuperset(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} aria-hidden="true" {...props}>
      <path d="M9.5 8.25a3.25 3.25 0 0 1 0 4.6l-.4.4a3.25 3.25 0 1 1-4.6-4.6l.85-.85" {...stroke} />
      <path d="M14.5 15.75a3.25 3.25 0 0 1 0-4.6l.4-.4a3.25 3.25 0 1 1 4.6 4.6l-.85.85" {...stroke} />
    </svg>
  );
}

export function IconDone(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} aria-hidden="true" {...props}>
      <path d="M6.5 12.25 10.2 16l7.3-8" {...stroke} />
    </svg>
  );
}

export function IconRemove(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} aria-hidden="true" {...props}>
      <path d="M7 7l10 10M17 7 7 17" {...stroke} />
    </svg>
  );
}

export function IconRename(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} aria-hidden="true" {...props}>
      <path d="M5.5 16.75V18.5H7.25L16.8 8.95 15.05 7.2 5.5 16.75Z" {...stroke} />
      <path d="M13.7 5.85l1.75 1.75" {...stroke} />
    </svg>
  );
}

export function IconTodayMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} aria-hidden="true" {...props}>
      <rect x="5" y="6" width="14" height="13" rx="2" {...stroke} />
      <path d="M8 4.5v3M16 4.5v3M5 10.5h14" {...stroke} />
    </svg>
  );
}

export function IconAddSet(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} aria-hidden="true" {...props}>
      <path d="M12 7v10M7 12h10" {...stroke} />
    </svg>
  );
}

export function IconVideo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="7.25" {...stroke} />
      <path d="M10.25 9.4v5.2L15.1 12 10.25 9.4Z" {...stroke} />
    </svg>
  );
}

export function IconHistory(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} aria-hidden="true" {...props}>
      <rect x="6.5" y="5" width="11" height="14" rx="1.5" {...stroke} />
      <path d="M9.5 9.5h5M9.5 12.5h5M9.5 15.5h3.5" {...stroke} />
    </svg>
  );
}

export function RestPresetPanel({
  value,
  onPick,
  close,
}: {
  value?: number;
  onPick: (seconds: number) => void;
  close: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 px-2 pb-2 pt-0.5">
      {REST_PRESETS.map((seconds) => (
        <button
          key={seconds}
          type="button"
          aria-pressed={value === seconds}
          onClick={() => {
            onPick(seconds);
            close();
          }}
          className={[
            "glass-chip h-9 rounded-pill px-3 text-[13px] font-medium",
            value === seconds ? "glass-chip-active text-ink" : "text-muted hover:text-ink",
          ].join(" ")}
        >
          {formatRestLabel(seconds)}
        </button>
      ))}
    </div>
  );
}

function formatRestLabel(seconds: number) {
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return ss === 0 ? `${mm}m` : `${mm}:${String(ss).padStart(2, "0")}`;
}
