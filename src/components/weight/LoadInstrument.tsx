import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import type { InputModeOption } from "../../lib/library";
import type { InputMethod, Unit } from "../../lib/units";
import { formatWeight } from "../../lib/workout";
import { usePagerGesture } from "../../hooks/usePagerGesture";

export interface LoadInstrumentPage {
  id: InputMethod;
  label: string;
  weight: number;
  weightDisplay?: ReactNode;
  /** Quiet gloss after the unit — e.g. "per hand" for a pair of bells. */
  qualifier?: string;
  stage?: ReactNode;
  extras?: ReactNode;
}

interface LoadInstrumentProps {
  unit: Unit;
  modes: InputModeOption[];
  mode: InputMethod;
  onModeChange: (mode: InputMethod) => void;
  pages: LoadInstrumentPage[];
  /** Larger hit target than the cluster — typically the open exercise card. */
  fieldRef?: RefObject<HTMLElement | null>;
  /** Sits on every equipment page, so Log stays one gap below the instrument. */
  footer?: ReactNode;
}

/** Active page height, blended while a swipe is between pages. */
function heightAt(progress: number, heights: number[], reduced: boolean) {
  const n = heights.length;
  if (n === 0) return 0;
  const clamped = Math.max(0, Math.min(n - 1, progress));
  if (reduced) return heights[Math.round(clamped)] ?? 0;
  const i = Math.floor(clamped);
  const t = clamped - i;
  const a = heights[i] ?? 0;
  const b = heights[Math.min(n - 1, i + 1)] ?? a;
  return a + (b - a) * t;
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function PageChevron({ direction }: { direction: "prev" | "next" }) {
  return (
    <svg viewBox="0 0 16 16" className="h-5 w-5" aria-hidden="true">
      <path
        d={direction === "prev" ? "M10 4 6 8l4 4" : "M6 4l4 4-4 4"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WeightHeader({
  unit,
  weight,
  weightDisplay,
  qualifier,
  gutter,
}: {
  unit: Unit;
  weight: number;
  weightDisplay?: ReactNode;
  qualifier?: string;
  /** Clear the side buttons so the live weight never sits under them. */
  gutter?: boolean;
}) {
  return (
    <div className={gutter ? "px-12 text-center" : "text-center"}>
      {weightDisplay ? (
        <div className="flex justify-center">{weightDisplay}</div>
      ) : (
        <p className="flex min-h-11 items-center justify-center whitespace-nowrap">
          <span className="tnum text-3xl font-semibold tracking-tight">
            {formatWeight(weight)}
          </span>
          <span className="ml-1.5 text-sm text-muted">{unit}</span>
          {qualifier ? (
            <span className="ml-2 text-[13px] text-muted">{qualifier}</span>
          ) : null}
        </p>
      )}
    </div>
  );
}

export function LoadInstrument({
  unit,
  modes,
  mode,
  onModeChange,
  pages,
  fieldRef,
  footer,
}: LoadInstrumentProps) {
  const visible = pages.filter((page) => modes.some((m) => m.id === page.id));
  const index = Math.max(
    0,
    visible.findIndex((page) => page.id === mode),
  );
  const paging = visible.length > 1;
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const heights = useRef<number[]>([]);
  const suppressClick = useRef(false);
  const progressRef = useRef(index);
  const draggingRef = useRef(false);

  const paint = useCallback(
    (progress: number, dragging: boolean) => {
      progressRef.current = progress;
      const track = trackRef.current;
      const viewport = viewportRef.current;
      const reduced = prefersReducedMotion();
      if (track) {
        const x = reduced ? -Math.round(progress) * 100 : -progress * 100;
        track.style.transform = `translate3d(${x}%, 0, 0)`;
      }
      pageRefs.current.forEach((page, i) => {
        if (!page) return;
        if (reduced) {
          page.style.transform = "none";
          page.style.opacity =
            Math.abs(i - Math.round(progress)) < 0.5 ? "1" : "0";
          return;
        }
        const delta = i - progress;
        const abs = Math.abs(delta);
        const clamped = Math.max(-1, Math.min(1, delta));
        page.style.transform = `rotateY(${clamped * -12}deg) scale(${1 - Math.min(abs, 1) * 0.05})`;
        page.style.opacity = String(1 - Math.min(abs, 1) * 0.32);
      });
      const h = heightAt(progress, heights.current, reduced);
      if (viewport && h > 0) viewport.style.height = `${Math.round(h)}px`;
      if (dragging) suppressClick.current = true;
      draggingRef.current = dragging;
      const field = (fieldRef ?? rootRef).current;
      const inMotion =
        dragging || Math.abs(progress - Math.round(progress)) > 0.001;
      field?.classList.toggle("is-paging", inMotion);
    },
    [fieldRef],
  );

  const measure = useCallback(() => {
    const next: number[] = [];
    pageRefs.current.forEach((page, i) => {
      if (!page) return;
      next[i] = page.scrollHeight;
    });
    heights.current = next;
    paint(progressRef.current, draggingRef.current);
  }, [paint]);

  const { goTo } = usePagerGesture({
    count: visible.length,
    index,
    enabled: paging,
    rootRef: fieldRef ?? rootRef,
    onProgress: paint,
    onIndexChange: (next) => {
      const page = visible[next];
      if (page && page.id !== mode) onModeChange(page.id);
    },
    getWidth: () => viewportRef.current?.clientWidth ?? 1,
  });

  const aim = useRef(index);
  useEffect(() => {
    aim.current = index;
  }, [index]);

  const stepPage = (delta: -1 | 1) => {
    const max = Math.max(0, visible.length - 1);
    const next = Math.max(0, Math.min(max, aim.current + delta));
    if (next === aim.current) return;
    aim.current = next;
    goTo(next);
  };

  useLayoutEffect(() => {
    measure();
    const observers = pageRefs.current.map((page) => {
      if (!page) return null;
      const ro = new ResizeObserver(measure);
      ro.observe(page);
      return ro;
    });
    return () => observers.forEach((ro) => ro?.disconnect());
  }, [measure, visible.map((page) => page.id).join(":")]);

  useLayoutEffect(() => {
    const field = (fieldRef ?? rootRef).current;
    if (!field) return;
    const onClick = (event: MouseEvent) => {
      if (!suppressClick.current) return;
      event.preventDefault();
      event.stopPropagation();
      suppressClick.current = false;
    };
    field.addEventListener("click", onClick, true);
    return () => field.removeEventListener("click", onClick, true);
  }, [fieldRef]);

  const methodLabel = visible[index]?.label ?? "weight";

  useEffect(() => {
    const field = (fieldRef ?? rootRef).current;
    if (!field || !paging) return;
    field.tabIndex = 0;
    field.setAttribute("role", "region");
    field.setAttribute(
      "aria-label",
      `Weight input, ${methodLabel}. Swipe, use the side buttons, or use arrow keys to change.`,
    );
    return () => {
      field.removeAttribute("role");
      field.removeAttribute("aria-label");
      field.removeAttribute("tabindex");
    };
  }, [fieldRef, methodLabel, paging]);

  const body = (page: LoadInstrumentPage, gutter = false, live = false) => (
    <div
      className="flex flex-col gap-2"
      aria-live={live ? "polite" : undefined}
    >
      <WeightHeader
        unit={unit}
        weight={page.weight}
        weightDisplay={page.weightDisplay}
        qualifier={page.qualifier}
        gutter={gutter}
      />
      {page.stage}
      {page.extras}
    </div>
  );

  const reps = footer ? (
    <div data-no-pager="" className="flex justify-center">
      {footer}
    </div>
  ) : null;

  const pageButton = (direction: "prev" | "next") => {
    const delta: -1 | 1 = direction === "prev" ? -1 : 1;
    const target = visible[index + delta];
    const atBound = !target;
    return (
      <button
        type="button"
        className="glass-btn pointer-events-auto flex h-11 w-11 items-center justify-center rounded-pill text-ink disabled:pointer-events-none"
        aria-label={
          target
            ? `${direction === "prev" ? "Previous" : "Next"}, ${target.label}`
            : direction === "prev"
              ? "Previous"
              : "Next"
        }
        disabled={atBound}
        onClick={() => stepPage(delta)}
      >
        <PageChevron direction={direction} />
      </button>
    );
  };

  if (!paging) {
    const page = visible[0];
    if (!page) return null;
    return (
      <div className="flex flex-col gap-4">
        {body(page, false, true)}
        {reps}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div ref={rootRef} className="load-pager-root">
        <div
          data-no-pager=""
          className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-11 items-center justify-center"
        >
          <div className="pointer-events-none flex w-full max-w-md items-center justify-between">
            {pageButton("prev")}
            {pageButton("next")}
          </div>
        </div>
        <div ref={viewportRef} className="load-pager">
          <div ref={trackRef} className="load-pager-track">
            {visible.map((page, i) => {
              const active = page.id === mode;
              return (
                <div
                  key={page.id}
                  ref={(el) => {
                    pageRefs.current[i] = el;
                  }}
                  className="load-pager-page"
                  aria-hidden={!active}
                  {...(!active ? { inert: "" } : {})}
                >
                  {body(page, true, active)}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {reps}
    </div>
  );
}
