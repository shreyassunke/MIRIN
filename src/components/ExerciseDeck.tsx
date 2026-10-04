import {
  Children,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";
import { usePagerGesture } from "../hooks/usePagerGesture";

interface ExerciseDeckProps {
  index: number;
  onIndexChange: (index: number) => void;
  label: string;
  children: ReactNode;
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

  const paint = useCallback((progress: number, dragging: boolean) => {
    progressRef.current = progress;
    draggingRef.current = dragging;
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
    const inMotion =
      dragging || Math.abs(progress - Math.round(progress)) > 0.001;
    rootRef.current?.classList.toggle("is-paging", inMotion);
  }, []);

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
    rootRef,
    onProgress: paint,
    onIndexChange,
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
  }, [measure, count, index]);

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
    <div ref={rootRef} className="load-swipe-field">
      <div ref={viewportRef} className="load-pager">
        <div ref={trackRef} className="load-pager-track">
          {pages.map((child, i) => {
            const active = i === index;
            return (
              <div
                key={i}
                ref={(el) => {
                  pageRefs.current[i] = el;
                }}
                className="load-pager-page"
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
