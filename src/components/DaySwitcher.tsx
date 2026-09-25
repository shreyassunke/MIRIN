import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type SVGProps,
} from "react";
import { createPortal } from "react-dom";
import type { DaySwitchOption, TodaySwitchMode } from "../lib/splits";

const MENU_WIDTH = 260;
const VIEW_PAD = 8;

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={[
        "h-4 w-4 shrink-0 text-muted transition-transform duration-150 motion-reduce:transition-none",
        open ? "rotate-180" : "",
      ].join(" ")}
      aria-hidden="true"
    >
      <path
        d="M4 6.5 8 10.5 12 6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" {...props}>
      <path
        d="M6.5 12.25 10.2 16l7.3-8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface DaySwitcherProps {
  dayName: string;
  currentId: string | null;
  scheduledId: string | null;
  options: DaySwitchOption[];
  onSwitch: (id: string, mode: TodaySwitchMode) => void;
}

export function DaySwitcher({
  dayName,
  currentId,
  scheduledId,
  options,
  onSwitch,
}: DaySwitcherProps) {
  const triggerId = useId();
  const listId = useId();
  const titleId = useId();
  const bodyId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, origin: "top left" });

  const canSwitch = options.length > 1;
  const pending = options.find((o) => o.id === pendingId);

  const closePicker = useCallback(() => setOpen(false), []);

  const closeDialog = useCallback(() => setPendingId(null), []);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;
    const rect = trigger.getBoundingClientRect();
    const menuH = menu.offsetHeight;
    const menuW = Math.max(MENU_WIDTH, menu.offsetWidth);
    const left = Math.min(
      Math.max(VIEW_PAD, rect.left),
      window.innerWidth - menuW - VIEW_PAD,
    );
    const below = rect.bottom + 6;
    const above = rect.top - menuH - 6;
    const fitsBelow = below + menuH <= window.innerHeight - VIEW_PAD;
    const top = fitsBelow ? below : Math.max(VIEW_PAD, above);
    setCoords({
      top,
      left,
      origin: fitsBelow ? "top left" : "bottom left",
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
  }, [open, options, place]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePicker();
        triggerRef.current?.focus();
      }
    };
    const onReposition = () => place();
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, closePicker, place]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      closePicker();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, closePicker]);

  useEffect(() => {
    if (!open) return;
    const current = options.findIndex((o) => o.id === currentId);
    const focusAt = current >= 0 ? current : 0;
    itemRefs.current[focusAt]?.focus();
  }, [open, options, currentId]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (pending) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [pending]);

  function focusItem(delta: number) {
    if (options.length === 0) return;
    const current = itemRefs.current.findIndex(
      (el) => el === document.activeElement,
    );
    const next =
      (current + delta + options.length) % options.length;
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
      itemRefs.current[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      itemRefs.current[options.length - 1]?.focus();
    }
  }

  function pick(id: string) {
    closePicker();
    if (id === currentId) return;
    // Reverting a one-day override to the scheduled session needs no prompt.
    if (id === scheduledId) {
      onSwitch(id, "today-only");
      return;
    }
    setPendingId(id);
  }

  function confirm(mode: TodaySwitchMode) {
    if (!pendingId) return;
    onSwitch(pendingId, mode);
    closeDialog();
  }

  const heading = (
    <h1 className="text-2xl font-semibold tracking-tight">{dayName}</h1>
  );

  if (!canSwitch) {
    return heading;
  }

  return (
    <>
      <h1 className="w-fit text-2xl font-semibold tracking-tight">
        <button
          ref={triggerRef}
          type="button"
          id={triggerId}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          onClick={() => setOpen((value) => !value)}
          className="-ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-left text-2xl font-semibold tracking-tight text-ink whitespace-nowrap"
        >
          <span>{dayName}</span>
          <Chevron open={open} />
        </button>
      </h1>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={listId}
            role="listbox"
            aria-labelledby={triggerId}
            onKeyDown={onMenuKeyDown}
            style={{
              top: coords.top,
              left: coords.left,
              width: MENU_WIDTH,
              transformOrigin: coords.origin,
            }}
            className="overflow-menu fixed z-50 max-h-[min(22rem,calc(100dvh-8rem))] overflow-y-auto rounded-xl p-1.5 shadow-glass glass"
          >
            {options.map((option, index) => {
              const selected = option.id === currentId;
              return (
                <button
                  key={option.id}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  type="button"
                  role="option"
                  id={`${listId}-${option.id}`}
                  aria-selected={selected}
                  onClick={() => pick(option.id)}
                  className={[
                    "flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-[15px] font-medium transition-colors duration-150 motion-reduce:transition-none",
                    selected
                      ? "bg-wash text-ink"
                      : "text-ink hover:bg-wash",
                  ].join(" ")}
                >
                  <span className="min-w-0 flex-1 truncate">{option.name}</span>
                  {selected ? (
                    <span className="shrink-0 text-muted">
                      <IconCheck />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
      {createPortal(
        <dialog
          ref={dialogRef}
          aria-labelledby={titleId}
          aria-describedby={bodyId}
          className="glass-dialog dialog-in glass"
          onClose={closeDialog}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          {pending ? (
            <>
              <h2
                id={titleId}
                className="text-lg font-semibold tracking-tight"
              >
                Switch to {pending.name}?
              </h2>
              <div id={bodyId} className="mt-2 space-y-2">
                <p className="text-sm leading-relaxed text-muted">
                  Today only leaves the split as it is.
                </p>
                <p className="text-sm leading-relaxed text-muted">
                  Update split makes {pending.name} today's slot from now on.
                </p>
              </div>
              <div className="mt-5 flex flex-col gap-2">
                <button
                  type="button"
                  autoFocus
                  onClick={() => confirm("today-only")}
                  className="btn-primary h-12 w-full rounded-pill bg-accent text-[15px] font-semibold text-bg hover:bg-ink"
                >
                  Today only
                </button>
                <button
                  type="button"
                  onClick={() => confirm("update-split")}
                  className="glass-btn h-12 w-full rounded-pill text-[15px] font-medium text-ink"
                >
                  Update split
                </button>
                <button
                  type="button"
                  onClick={closeDialog}
                  className="h-11 w-full text-[13px] font-medium text-muted transition-colors duration-150 hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : null}
        </dialog>,
        document.body,
      )}
    </>
  );
}
