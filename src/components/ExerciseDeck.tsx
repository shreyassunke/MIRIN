import {
  Children,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { usePagerGesture } from "../hooks/usePagerGesture";

interface ExerciseDeckProps {
  index: number;
  onIndexChange: (index: number) => void;
  label: string;
  children: ReactNode;
  /** Own horizontal paging from this node — typically the whole Today page. */
  fieldRef?: RefObject<HTMLElement | null>;
}

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

export function ExerciseDeck({
  index,
  onIndexChange,
  label,
  children,
  fieldRef,
}: ExerciseDeckProps) {
  const pages = Children.toArray(children);
  const count = pages.length;
  const paging = count > 1;
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const heights = useRef<number[]>([]);
  const progressRef = useRef(index);
  const draggingRef = useRef(false);
  const gestureRef = fieldRef ?? rootRef;

  const paint = useCallback((progress: number, dragging: boolean) => {
    progressRef.current = progress;
    draggingRef.current = dragging;
    const track = trackRef.current;
    const viewport = viewportRef.current;
    const reduced = prefersReducedMotion();
    const width = viewport?.clientWidth ?? 0;
    if (track) {
      const x = reduced ? -Math.round(progress) * width : -progress * width;
      track.style.transform = width
        ? `translate3d(${x}px, 0, 0)`
        : `translate3d(${-progress * 100}%, 0, 0)`;
    }
    pageRefs.current.forEach((page) => {
      if (!page) return;
      page.style.transform = "none";
      page.style.opacity = "1";
    });
    const h = heightAt(progress, heights.current, reduced);
    if (viewport && h > 0) viewport.style.height = `${Math.round(h)}px`;
    const inMotion =
      dragging || Math.abs(progress - Math.round(progress)) > 0.001;
    gestureRef.current?.classList.toggle("is-paging", inMotion);
  }, [gestureRef]);

  const measure = useCallback(() => {
    const next: number[] = [];
    pageRefs.current.forEach((page, i) => {
      if (!page) return;
      next[i] = page.scrollHeight;
    });
    heights.current = next;
    paint(progressRef.current, draggingRef.current);
  }, [paint]);

  usePagerGesture({
    count,
    index,
    enabled: paging,
    rootRef: gestureRef,
    onProgress: paint,
    onIndexChange,
    getWidth: () => viewportRef.current?.clientWidth ?? 1,
    claim: "page",
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
  }, [measure, count]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !paging) return;
    root.tabIndex = 0;
    root.setAttribute("role", "region");
    root.setAttribute(
      "aria-label",
      `${label}. Swipe or use arrow keys to change exercise.`,
    );
    return () => {
      root.removeAttribute("role");
      root.removeAttribute("aria-label");
      root.removeAttribute("tabindex");
    };
  }, [label, paging]);

  if (!paging) {
    return <div>{pages[0]}</div>;
  }

  return (
    <div ref={rootRef} className={fieldRef ? undefined : "load-swipe-field"}>
      <div ref={viewportRef} className="exercise-deck">
        <div ref={trackRef} className="exercise-deck-track">
          {pages.map((child, i) => {
            const active = i === index;
            return (
              <div
                key={i}
                ref={(el) => {
                  pageRefs.current[i] = el;
                }}
                className="exercise-deck-page"
                aria-hidden={!active}
                {...(!active ? { inert: "" } : {})}
              >
                {child}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
