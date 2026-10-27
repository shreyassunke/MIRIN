import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  areaUnder,
  monotoneCurve,
  paddedDomain,
  QUOTE_RANGES,
  type QuotePoint,
  type QuoteRangeId,
} from "../lib/quoteSeries";
import type { PhysiqueControl, PhysiqueGesture, Slot } from "./physique/gesture";

const PAD_L = 2;
const PAD_R = 48;
const PAD_T = 14;
const PAD_B = 22;
const TAP_PX = 12;

interface Drag {
  id: number;
  x: number;
  y: number;
  locked: boolean;
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function QuotePlot({
  points,
  scrub,
  onScrub,
  label,
  empty,
  overlay,
  figureRef,
  controlRef,
}: {
  points: QuotePoint[];
  scrub: number | null;
  onScrub: (index: number | null) => void;
  label: string;
  empty?: ReactNode;
  /** Drawn between the series and the scrub mark. Pointers pass through it. */
  overlay?: ReactNode;
  figureRef?: Slot<PhysiqueGesture | null>;
  controlRef?: Slot<PhysiqueControl | null>;
}) {
  const plotRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const route = useRef<"pass" | "figure" | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [touchLock, setTouchLock] = useState(false);
  const gradientId = useId().replace(/:/g, "");
  const scrubRef = useRef(onScrub);
  scrubRef.current = onScrub;

  const touchLockRef = useRef(false);
  touchLockRef.current = touchLock;

  useEffect(() => {
    if (!controlRef) return;
    controlRef.current = {
      claim(pointerId) {
        const node = plotRef.current;
        if (!node) return;
        try {
          node.setPointerCapture(pointerId);
        } catch {
          /* pointer already released */
        }
      },
      touchLock(locked) {
        const node = plotRef.current;
        if (node) node.style.touchAction = locked ? "none" : "";
        setTouchLock(locked);
      },
    };
    return () => {
      controlRef.current = null;
    };
  }, [controlRef]);

  useEffect(() => {
    const node = plotRef.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      figureRef?.current?.wheel(event);
    };
    const onTouchMove = (event: TouchEvent) => {
      const figureOwns = figureRef?.current?.blocksScroll() ?? false;
      if (!touchLockRef.current && !drag.current?.locked && !figureOwns) return;
      if (event.cancelable) event.preventDefault();
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    node.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      node.removeEventListener("wheel", onWheel);
      node.removeEventListener("touchmove", onTouchMove);
    };
  }, [figureRef]);

  useLayoutEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setBox({ w: rect.width, h: rect.height });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [points.length]);

  const geometry = useMemo(() => {
    const plotW = Math.max(0, box.w - PAD_L - PAD_R);
    const plotH = Math.max(0, box.h - PAD_T - PAD_B);
    const floor = PAD_T + plotH;
    if (points.length === 0 || plotW < 8 || plotH < 8) return null;
    const [min, max] = paddedDomain(points.map((point) => point.value));
    const spanT = points[points.length - 1].t - points[0].t || 1;
    const spanY = max - min || 1;
    const coords = points.map((point) => ({
      x: PAD_L + ((point.t - points[0].t) / spanT) * plotW,
      y: PAD_T + ((max - point.value) / spanY) * plotH,
    }));
    const line = monotoneCurve(coords);
    const ticks = [0.12, 0.5, 0.88].map((t) => ({
      y: PAD_T + t * plotH,
      value: max - t * (max - min),
    }));
    const first = points[0].t;
    const last = points[points.length - 1].t;
    const sameYear =
      new Date(first).getFullYear() === new Date(last).getFullYear() &&
      new Date(last).getFullYear() === new Date().getFullYear();
    const labels = [0, 0.5, 1].map((fraction) => {
      const t = first + fraction * spanT;
      return {
        x: PAD_L + fraction * plotW,
        text: new Date(t).toLocaleDateString(undefined, {
          month: "short",
          day: sameYear ? "numeric" : undefined,
          year: sameYear ? undefined : "numeric",
        }),
        anchor: fraction === 0 ? "start" : fraction === 1 ? "end" : "middle",
      };
    });
    return {
      coords,
      line,
      area: areaUnder(line, coords[0].x, coords[coords.length - 1].x, floor),
      ticks,
      labels: last > first ? labels : [labels[0]],
    };
  }, [box.h, box.w, points]);

  function indexAt(clientX: number) {
    const host = plotRef.current;
    if (!host || points.length === 0 || !geometry) return 0;
    const rect = host.getBoundingClientRect();
    const x = clientX - rect.left;
    let best = 0;
    let bestDist = Infinity;
    geometry.coords.forEach((coord, index) => {
      const dist = Math.abs(coord.x - x);
      if (dist < bestDist) {
        bestDist = dist;
        best = index;
      }
    });
    return best;
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const figure = figureRef?.current;
    if (figure) {
      const role = figure.down(event.nativeEvent);
      route.current = role;
      if (role === "figure") {
        drag.current = null;
        scrubRef.current(null);
        return;
      }
    } else {
      route.current = "pass";
    }
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      locked: false,
    };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const figure = figureRef?.current;
    if (route.current === "figure" && figure) {
      figure.move(event.nativeEvent);
      return;
    }
    if (route.current === "pass" && figure && (drag.current || event.buttons > 0)) {
      const role = figure.move(event.nativeEvent);
      if (role === "figure") {
        route.current = "figure";
        drag.current = null;
        scrubRef.current(null);
        return;
      }
    }
    if (points.length < 2) return;
    const current = drag.current;
    if (event.pointerType === "mouse" && !current && event.buttons === 0) {
      scrubRef.current(indexAt(event.clientX));
      return;
    }
    if (!current || current.id !== event.pointerId) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (!current.locked) {
      if (Math.hypot(dx, dy) < 6) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        drag.current = null;
        return;
      }
      current.locked = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (event.cancelable) event.preventDefault();
    scrubRef.current(indexAt(event.clientX));
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const figure = figureRef?.current;
    const routing = route.current;
    if (routing === "figure" && figure) {
      const role = figure.up(event.nativeEvent);
      route.current = role === "figure" ? "figure" : null;
      return;
    }
    if (routing === "pass" && figure) {
      const role = figure.up(event.nativeEvent);
      if (role === "figure") {
        route.current = "figure";
        drag.current = null;
        scrubRef.current(null);
        return;
      }
    }
    route.current = null;
    const current = drag.current;
    const tapped =
      current != null &&
      current.id === event.pointerId &&
      !current.locked &&
      Math.hypot(event.clientX - current.x, event.clientY - current.y) <= TAP_PX;
    if (drag.current?.id === event.pointerId) drag.current = null;
    scrubRef.current(null);
    if (tapped && figure) {
      const bounds = plotRef.current
        ?.querySelector(".volume-figure")
        ?.getBoundingClientRect();
      const onFigure =
        bounds != null &&
        event.clientX >= bounds.left &&
        event.clientX <= bounds.right &&
        event.clientY >= bounds.top &&
        event.clientY <= bounds.bottom;
      if (onFigure) figure.tap(event.clientX, event.clientY);
    }
  }

  function onPointerLeave(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) return;
    if (drag.current || route.current) return;
    scrubRef.current(null);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (points.length < 2) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Escape") {
      return;
    }
    event.preventDefault();
    if (event.key === "Escape") {
      scrubRef.current(null);
      return;
    }
    const step = event.key === "ArrowRight" ? 1 : -1;
    const base = scrub ?? points.length - 1;
    scrubRef.current(Math.max(0, Math.min(points.length - 1, base + step)));
  }

  const activeCoord =
    scrub != null ? geometry?.coords[scrub] : geometry?.coords.at(-1);
  const showSeries = points.length >= 2 && geometry;

  return (
    <div
      ref={plotRef}
      className="quote-plot"
      data-no-pager=""
      data-pager-keys=""
      tabIndex={showSeries && points.length > 1 ? 0 : undefined}
      role={overlay ? "group" : showSeries ? "img" : undefined}
      aria-label={showSeries || overlay ? label : undefined}
      style={touchLock ? { touchAction: "none" } : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerLeave}
      onKeyDown={onKeyDown}
      onBlur={() => scrubRef.current(null)}
    >
      {showSeries ? (
        <svg
          className="quote-svg"
          width={box.w}
          height={box.h}
          viewBox={`0 0 ${box.w} ${box.h}`}
          aria-hidden="true"
        >
          <defs>
            <linearGradient
              id={gradientId}
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1={PAD_T}
              x2="0"
              y2={Math.max(PAD_T + 1, box.h - PAD_B)}
            >
              <stop offset="0%" stopColor="var(--quote-ink)" stopOpacity="0.34" />
              <stop offset="55%" stopColor="var(--quote-ink)" stopOpacity="0.13" />
              <stop offset="100%" stopColor="var(--quote-ink)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={geometry.area} fill={`url(#${gradientId})`} />
          <path
            d={geometry.line}
            fill="none"
            stroke="var(--quote-ink)"
            strokeWidth="1.75"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {geometry.ticks.map((tick) => (
            <text
              key={tick.y}
              x={box.w - 2}
              y={tick.y}
              className="quote-tick"
              textAnchor="end"
              dominantBaseline="middle"
            >
              {Math.round(tick.value)}
            </text>
          ))}
          {geometry.labels.map((item) => (
            <text
              key={`${item.x}-${item.text}`}
              x={
                item.anchor === "start"
                  ? item.x + 2
                  : item.anchor === "end"
                    ? item.x - 2
                    : item.x
              }
              y={box.h - 4}
              className="quote-tick"
              textAnchor={item.anchor as "start" | "middle" | "end"}
            >
              {item.text}
            </text>
          ))}
        </svg>
      ) : (
        <div onPointerDown={(event) => event.stopPropagation()}>{empty}</div>
      )}
      {overlay}
      {showSeries ? (
        <svg
          className="quote-svg quote-svg-fore"
          width={box.w}
          height={box.h}
          viewBox={`0 0 ${box.w} ${box.h}`}
          aria-hidden="true"
        >
          {scrub != null && activeCoord ? (
            <line
              x1={activeCoord.x}
              x2={activeCoord.x}
              y1={PAD_T}
              y2={PAD_T + Math.max(0, box.h - PAD_T - PAD_B)}
              stroke="var(--color-muted)"
              strokeOpacity="0.6"
              strokeWidth="1"
            />
          ) : null}
          {activeCoord ? (
            <g>
              <circle cx={activeCoord.x} cy={activeCoord.y} r="6" fill="var(--color-bg)" />
              <circle cx={activeCoord.x} cy={activeCoord.y} r="3.25" fill="var(--quote-ink)" />
            </g>
          ) : null}
        </svg>
      ) : null}
    </div>
  );
}

export function QuoteRanges({
  value,
  onChange,
}: {
  value: QuoteRangeId;
  onChange: (next: QuoteRangeId) => void;
}) {
  const rangesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const strip = rangesRef.current;
    const selected = strip?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!strip || !selected) return;
    const viewLeft = strip.scrollLeft;
    const viewRight = viewLeft + strip.clientWidth;
    const left = selected.offsetLeft;
    const right = left + selected.offsetWidth;
    if (left >= viewLeft + 4 && right <= viewRight - 4) return;
    strip.scrollTo({
      left: Math.max(0, left - (strip.clientWidth - selected.offsetWidth) / 2),
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, [value]);

  return (
    <div
      ref={rangesRef}
      className="quote-ranges"
      data-no-pager=""
      role="tablist"
      aria-label="Time range"
    >
      {QUOTE_RANGES.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          className="quote-range"
          aria-selected={value === item.id}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
