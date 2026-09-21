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
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function WeightHeader({
  unit,
  weight,
  weightDisplay,
  qualifier,
}: {
  unit: Unit;
  weight: number;
  weightDisplay?: ReactNode;
  qualifier?: string;
}) {
  return (
    <div className="mb-3 text-center">
      {weightDisplay ?? (
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
      const width = viewport?.clientWidth ?? 0;
      if (track) {
        if (reduced) {
          track.style.transform = `translate3d(${-Math.round(progress) * width}px, 0, 0)`;
        } else {
          track.style.transform = `translate3d(${-progress * width}px, 0, 0)`;
        }
      }
      let maxH = 0;
      for (const h of heights.current) {
        if (h > maxH) maxH = h;
      }
      if (viewport && maxH > 0) viewport.style.height = `${maxH}px`;
      if (dragging) suppressClick.current = true;
      draggingRef.current = dragging;
      const field = (fieldRef ?? rootRef).current;
      field?.classList.toggle("is-paging", dragging);
    },
    [fieldRef, visible.length],
  );

  const measure = useCallback(() => {
    pageRefs.current.forEach((page, i) => {
      if (!page) return;
      heights.current[i] = page.scrollHeight;
    });
    paint(progressRef.current, draggingRef.current);
  }, [paint]);

  usePagerGesture({
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
      `Weight input, ${methodLabel}. Swipe or use arrow keys to change.`,
    );
    return () => {
      field.removeAttribute("role");
      field.removeAttribute("aria-label");
      field.removeAttribute("tabindex");
    };
  }, [fieldRef, methodLabel, paging]);

  const body = (page: LoadInstrumentPage) => (
    <>
      <WeightHeader
        unit={unit}
        weight={page.weight}
        weightDisplay={page.weightDisplay}
        qualifier={page.qualifier}
      />
      {page.stage}
      {page.extras}
    </>
  );

  if (!paging) {
    const page = visible[0];
    if (!page) return null;
    return <div>{body(page)}</div>;
  }

  return (
    <div ref={rootRef} className="load-pager-root">
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
                {...(!active ? { inert: true } : {})}
              >
                <div aria-live={active ? "polite" : undefined}>{body(page)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
