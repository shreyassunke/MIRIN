import {
  Children,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { usePagerGesture } from "../hooks/usePagerGesture";

interface ExerciseDeckProps {
  index: number;
  onIndexChange: (index: number) => void;
  label: string;
  /** Accessible name for each dot, in page order. */
  pageLabels?: string[];
  /** Resets the locked frame height when the exercise list changes. */
  frameKey: string;
  children: ReactNode;
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

const PHONE_BOX = "(max-width: 767px)";

function phoneBox() {
  return typeof window !== "undefined" && window.matchMedia(PHONE_BOX).matches;
}

/**
 * Continuous dot diameter (px): 6px within 2 steps, 4px at 3 steps,
 * and 3px at 4+ steps, interpolating 1:1 during a swipe.
 */
export function dotSizeAt(distance: number): number {
  const d = Math.abs(distance);
  if (d <= 2) return 6;
  if (d < 3) return 6 - (d - 2) * 2;
  if (d < 4) return 4 - (d - 3);
  return 3;
}

/**
 * Ink percentage (42%–100%) for dot `i`.
 * During finger drag, the incoming dot brightens 1:1 with finger progress and
 * snaps to 100% the instant the midpoint is crossed or the flick commits.
 */
export function dotInkAt(
  i: number,
  progress: number,
  activeDot: number,
  dragging: boolean,
): number {
  if (i === activeDot) return 100;
  if (!dragging) return 42;
  const proximity = Math.max(0, 1 - Math.abs(i - progress));
  return Math.round(42 + 46 * proximity);
}

/**
 * One frame, the way a multi-photo post keeps one box. On a phone the
 * box is the screen slot, so a swipe never changes its height. On a
 * wide layout the settled page sets the height, and mid-swipe the frame
 * is the taller of the two so neither clips.
 */
export function ExerciseDeck({
  index,
  onIndexChange,
  label,
  pageLabels,
  frameKey,
  children,
}: ExerciseDeckProps) {
  const pages = Children.toArray(children);
  const count = pages.length;
  const paging = count > 1;
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dotRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const countRef = useRef(count);
  countRef.current = count;
  pageRefs.current.length = count;
  dotRefs.current.length = count;
  const heights = useRef<number[]>([]);
  const progressRef = useRef(index);
  const targetRef = useRef(index);
  const draggingRef = useRef(false);
  const fixedBox = useRef(phoneBox());

  const paint = useCallback(
    (progress: number, dragging: boolean, target = targetRef.current) => {
      progressRef.current = progress;
      targetRef.current = target;
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
      const inMotion =
        dragging || Math.abs(progress - Math.round(progress)) > 0.001;
      rootRef.current?.classList.toggle("is-paging", inMotion);

      const dots = dotRefs.current;
      const dotCount = countRef.current;
      if (dotCount > 0) {
        const max = Math.max(0, dotCount - 1);
        const clampedPos = Math.max(0, Math.min(max, progress));
        const activeDot = Math.max(
          0,
          Math.min(max, dragging ? Math.round(clampedPos) : target),
        );
        const sizeAnchor = reduced ? activeDot : clampedPos;
        for (let i = 0; i < dotCount; i++) {
          const btn = dots[i];
          if (!btn) continue;
          const size = dotSizeAt(Math.abs(i - sizeAnchor));
          const ink = dotInkAt(i, clampedPos, activeDot, dragging && !reduced);
          btn.style.setProperty("--dot", `${Math.round(size * 100) / 100}px`);
          btn.style.setProperty("--dot-ink", `${ink}%`);
          if (i === activeDot) {
            if (btn.getAttribute("aria-current") !== "true") {
              btn.setAttribute("aria-current", "true");
            }
          } else if (btn.hasAttribute("aria-current")) {
            btn.removeAttribute("aria-current");
          }
        }
      }

      if (!viewport) return;
      if (fixedBox.current) {
        if (viewport.style.height) viewport.style.height = "";
        return;
      }
      const pages = heights.current;
      const n = pages.length;
      if (n === 0) return;
      const clamped = Math.max(0, Math.min(n - 1, progress));
      let next = 0;
      if (!inMotion) {
        next = pages[Math.round(clamped)] || 0;
      } else {
        const i = Math.floor(clamped);
        next = Math.max(pages[i] || 0, pages[Math.min(n - 1, i + 1)] || 0);
      }
      if (next > 0) viewport.style.height = `${Math.round(next)}px`;
    },
    [],
  );

  useEffect(() => {
    const mq = window.matchMedia(PHONE_BOX);
    const onChange = () => {
      fixedBox.current = mq.matches;
      paint(progressRef.current, draggingRef.current, targetRef.current);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [paint]);

  const { goTo } = usePagerGesture({
    count,
    index,
    enabled: paging,
    rootRef,
    onProgress: paint,
    onIndexChange,
    getWidth: () => viewportRef.current?.clientWidth ?? 1,
    claim: "page",
  });

  const measure = useCallback(() => {
    const next: number[] = [];
    pageRefs.current.forEach((page, i) => {
      if (!page) return;
      next[i] = page.scrollHeight;
    });
    heights.current = next;
    paint(progressRef.current, draggingRef.current, targetRef.current);
  }, [paint]);

  useLayoutEffect(() => {
    measure();
  }, [frameKey, measure]);

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
      `${label}. Exercise ${index + 1} of ${count}. Swipe or use arrow keys to change exercise.`,
    );
    return () => {
      root.removeAttribute("role");
      root.removeAttribute("aria-label");
      root.removeAttribute("tabindex");
    };
  }, [count, index, label, paging]);

  if (!paging) {
    return (
      <div className="exercise-frame" data-exercise-frame="">
        <div className="load-swipe-field">
          <div className="exercise-deck">
            <div className="exercise-deck-page">{pages[0]}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="exercise-frame" data-exercise-frame="">
      <div ref={rootRef} className="load-swipe-field">
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
      <div
        className="exercise-dots"
        role="group"
        aria-label="Exercises in this workout"
      >
        {pages.map((_, i) => {
          const selected = i === index;
          const distance = Math.abs(i - index);
          const name = pageLabels?.[i] ?? `Exercise ${i + 1}`;
          const dot = dotSizeAt(distance);
          return (
            <button
              key={i}
              ref={(el) => {
                dotRefs.current[i] = el;
              }}
              type="button"
              className="exercise-dot"
              style={
                {
                  "--dot": `${dot}px`,
                  "--dot-ink": selected ? "100%" : "42%",
                } as CSSProperties
              }
              aria-label={`${name}, ${i + 1} of ${count}`}
              aria-current={selected ? "true" : undefined}
              onClick={() => goTo(i)}
            />
          );
        })}
      </div>
    </div>
  );
}
