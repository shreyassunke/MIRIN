import {
  useCallback,
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
  stage?: ReactNode;
  extras?: ReactNode;
}

interface LoadInstrumentProps {
  unit: Unit;
  /** Last session's matching set, already in the display unit. */
  ghost?: number | null;
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
  ghost,
  weightDisplay,
}: {
  unit: Unit;
  weight: number;
  ghost?: number | null;
  weightDisplay?: ReactNode;
}) {
  return (
    <div className="mb-3 text-center">
      {weightDisplay ?? (
        <p className="flex min-h-11 items-center justify-center">
          <span className="tnum text-3xl font-semibold tracking-tight">
            {formatWeight(weight)}
          </span>
          <span className="ml-1.5 text-sm text-muted">{unit}</span>
        </p>
      )}
      {ghost != null && (
        <p className="tnum mt-0.5 text-sm text-muted">{formatWeight(ghost)}</p>
      )}
    </div>
  );
}

export function LoadInstrument({
  unit,
  ghost,
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
  const thumbRef = useRef<HTMLSpanElement>(null);
  const dotRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const suppressClick = useRef(false);
  const progressRef = useRef(index);
  const draggingRef = useRef(false);

  const paintThumb = useCallback((progress: number) => {
    const thumb = thumbRef.current;
    const parent = thumb?.parentElement;
    if (!thumb || !parent) return;
    const count = visible.length;
    const left = Math.max(0, Math.min(count - 1, Math.floor(progress)));
    const right = Math.max(0, Math.min(count - 1, Math.ceil(progress)));
    const a = dotRefs.current[left];
    const b = dotRefs.current[right];
    if (!a || !b) return;
    const box = parent.getBoundingClientRect();
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    const t = progress - left;
    const cx =
      ra.left +
      ra.width / 2 +
      (rb.left + rb.width / 2 - (ra.left + ra.width / 2)) * t -
      box.left;
    const stretch = left === right ? 0 : 10 * Math.sin(t * Math.PI);
    const width = 14 + stretch;
    thumb.style.width = `${width}px`;
    thumb.style.transform = `translate3d(${cx - width / 2}px, -50%, 0)`;
    dotRefs.current.forEach((dot, i) => {
      const mark = dot?.firstElementChild as HTMLElement | null;
      if (!mark) return;
      const dist = Math.abs(i - progress);
      mark.style.opacity = dist < 0.45 ? "0" : dist < 1 ? "0.45" : "0.7";
    });
  }, [visible.length]);

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
          page.style.opacity = Math.abs(i - Math.round(progress)) < 0.5 ? "1" : "0";
          return;
        }
        const delta = i - progress;
        const abs = Math.abs(delta);
        const clamped = Math.max(-1, Math.min(1, delta));
        page.style.transform = `rotateY(${clamped * -12}deg) scale(${1 - Math.min(abs, 1) * 0.05})`;
        page.style.opacity = String(1 - Math.min(abs, 1) * 0.32);
      });
      const count = visible.length;
      const left = Math.max(0, Math.min(count - 1, Math.floor(progress)));
      const right = Math.max(0, Math.min(count - 1, Math.ceil(progress)));
      const t = progress - left;
      const h0 = heights.current[left] ?? 0;
      const h1 = heights.current[right] ?? h0;
      if (viewport && h0 > 0) {
        viewport.style.height = `${h0 + (h1 - h0) * t}px`;
      }
      if (dragging) suppressClick.current = true;
      draggingRef.current = dragging;
      const field = (fieldRef ?? rootRef).current;
      field?.classList.toggle("is-paging", dragging);
      paintThumb(progress);
    },
    [fieldRef, paintThumb, visible.length],
  );

  const measure = useCallback(() => {
    pageRefs.current.forEach((page, i) => {
      if (!page) return;
      heights.current[i] = page.scrollHeight;
    });
    paint(progressRef.current, draggingRef.current);
  }, [paint]);

  const pager = usePagerGesture({
    count: visible.length,
    index,
    enabled: paging,
    rootRef: fieldRef ?? rootRef,
    onProgress: paint,
    onIndexChange: (next) => {
      const page = visible[next];
      if (page && page.id !== mode) onModeChange(page.id);
    },
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

  const body = (page: LoadInstrumentPage) => (
    <>
      <WeightHeader
        unit={unit}
        weight={page.weight}
        ghost={ghost}
        weightDisplay={page.weightDisplay}
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
      <div
        role="group"
        aria-label="Weight input method"
        className="load-pager-dots glass"
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            pager.goTo(Math.min(visible.length - 1, index + 1));
          } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            pager.goTo(Math.max(0, index - 1));
          }
        }}
      >
        <span ref={thumbRef} className="load-pager-thumb" aria-hidden="true" />
        {visible.map((page, i) => {
          const active = page.id === mode;
          return (
            <button
              key={page.id}
              ref={(el) => {
                dotRefs.current[i] = el;
              }}
              type="button"
              aria-label={page.label}
              aria-pressed={active}
              onClick={() => pager.goTo(i)}
              className="load-pager-dot"
            >
              <span className="load-pager-mark" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
