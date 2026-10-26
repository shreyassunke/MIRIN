import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { LoadBreakdown, SetLog } from "../db/db";
import { useUnit } from "../lib/settings";
import { toDisplay, type Unit } from "../lib/units";
import {
  areaUnder,
  filterRange,
  formatPercent,
  inRange,
  monotoneCurve,
  paddedDomain,
  QUOTE_RANGES,
  quoteDelta,
  signedNumber,
  type QuotePoint,
  type QuoteRangeId,
} from "../lib/quoteSeries";
import { bestWorkingEstimate, exerciseHistory, formatSet, formatWeight } from "../lib/workout";

const PAD_L = 2;
const PAD_R = 48;
const PAD_T = 14;
const PAD_B = 22;

interface Drag {
  id: number;
  x: number;
  y: number;
  locked: boolean;
}

function sessionDate(iso: string, now = new Date()) {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

function breakdownText(breakdown: LoadBreakdown, unit: Unit): string | null {
  if (!breakdown.platesPerSide?.length) return null;
  const plates = breakdown.platesPerSide
    .map((plate) => formatWeight(toDisplay(plate, unit)))
    .join(" · ");
  const bar =
    breakdown.barWeight !== undefined
      ? `Bar ${formatWeight(toDisplay(breakdown.barWeight, unit))} + `
      : "";
  return `${bar}${plates} per side`;
}

function sessionBreakdown(sets: SetLog[], unit: Unit): string | null {
  const withPlates = sets.filter(
    (set) => !set.isWarmup && set.loadBreakdown?.platesPerSide?.length,
  );
  if (withPlates.length === 0) return null;
  const top = withPlates.reduce((best, set) => (set.weight > best.weight ? set : best));
  return breakdownText(top.loadBreakdown!, unit);
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

const RANGE_PHRASE: Record<QuoteRangeId, string> = {
  "1W": "Past week",
  "1M": "Past month",
  "3M": "Past 3 months",
  "6M": "Past 6 months",
  YTD: "Year to date",
  "1Y": "Past year",
  "2Y": "Past 2 years",
  "5Y": "Past 5 years",
  ALL: "All sessions",
};

export function ExerciseQuote({
  exerciseId,
  name,
  muscle,
  titled = false,
}: {
  exerciseId: string;
  name: string;
  muscle?: string;
  /** Today names the lift above the reading; the exercise page has its own heading. */
  titled?: boolean;
}) {
  const [unit] = useUnit();
  const [range, setRange] = useState<QuoteRangeId>("ALL");
  const [scrub, setScrub] = useState<number | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const plotRef = useRef<HTMLDivElement>(null);
  const rangesRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const gradientId = useId().replace(/:/g, "");

  const history = useLiveQuery(
    () => exerciseHistory(exerciseId),
    [exerciseId],
  );

  useEffect(() => {
    setScrub(null);
  }, [exerciseId]);

  const series = useMemo<QuotePoint[]>(() => {
    if (!history) return [];
    return [...history]
      .reverse()
      .map(({ session, sets }) => {
        const estimate = bestWorkingEstimate(sets);
        return {
          t: new Date(session.date).getTime(),
          // An Epley estimate is not precise past the whole unit.
          value: Math.round(toDisplay(estimate, unit)),
          label: sessionDate(session.date),
          estimate,
        };
      })
      .filter((point) => point.estimate > 0)
      .map(({ t, value, label }) => ({ t, value, label }));
  }, [history, unit]);

  const points = useMemo(
    () => filterRange(series, range),
    [series, range],
  );

  const focus = scrub != null ? points[scrub] : points[points.length - 1];
  const delta = quoteDelta(
    focus && points.length > 0 ? [points[0], focus] : points,
  );
  const tone = delta?.tone ?? "flat";

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
  }, [range]);

  const geometry = useMemo(() => {
    const plotW = Math.max(0, box.w - PAD_L - PAD_R);
    const plotH = Math.max(0, box.h - PAD_T - PAD_B);
    const floor = PAD_T + plotH;
    if (points.length === 0 || plotW < 8 || plotH < 8) {
      return null;
    }
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
    // Dates sit at even fractions of the window, not at session midpoints,
    // so clustered sessions do not crowd one end of the axis.
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

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    // A drag on the line changes the exercise. Hover still reads a session.
    if (event.currentTarget.closest("[data-page-swipe]")) return;
    if (points.length < 2) return;
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      locked: false,
    };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (points.length < 2) return;
    const current = drag.current;
    if (event.pointerType === "mouse" && !current && event.buttons === 0) {
      setScrub(indexAt(event.clientX));
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
    setScrub(indexAt(event.clientX));
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    setScrub(null);
  }

  function onPointerLeave(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) return;
    if (drag.current) return;
    setScrub(null);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (points.length < 2) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Escape") {
      return;
    }
    event.preventDefault();
    if (event.key === "Escape") {
      setScrub(null);
      return;
    }
    setScrub((current) => {
      const base = current ?? points.length - 1;
      const step = event.key === "ArrowRight" ? 1 : -1;
      return Math.max(0, Math.min(points.length - 1, base + step));
    });
  }

  const shown = focus?.value;
  const amountText =
    delta && points.length > 1
      ? signedNumber(delta.amount, formatWeight(Math.abs(delta.amount)))
      : null;
  const percentText =
    delta?.percent != null && points.length > 1 ? formatPercent(delta.percent) : null;
  const toneWord = tone === "up" ? "up" : tone === "down" ? "down" : "unchanged";
  const meta =
    scrub != null && focus
      ? focus.label
      : points.length > 1
        ? RANGE_PHRASE[range]
        : points.length === 1
          ? focus?.label ?? ""
          : "";

  const chartLabel = shown != null
    ? `${name} estimated 1RM ${formatWeight(shown)} ${unit}, ${toneWord}${
        amountText ? ` ${amountText}` : ""
      }, ${RANGE_PHRASE[range].toLowerCase()}`
    : `${name} estimated 1RM`;

  const sessions = useMemo(() => {
    if (!history) return [];
    const now = new Date();
    return history.filter(({ session, sets }) => {
      if (bestWorkingEstimate(sets) <= 0) return false;
      return inRange(new Date(session.date).getTime(), range, now);
    });
  }, [history, range]);

  const activeCoord = scrub != null ? geometry?.coords[scrub] : geometry?.coords.at(-1);

  return (
    <section
      className="exercise-quote"
      data-tone={shown == null ? "flat" : tone}
      aria-busy={history === undefined}
    >
      {titled ? (
        <header className="quote-title">
          <h2>{name}</h2>
          {muscle ? <span>{muscle}</span> : null}
        </header>
      ) : null}

      <div className="quote-readout">
        <p className="quote-label">Estimated 1RM</p>
        <p className="quote-value tnum">
          {shown == null ? "—" : formatWeight(shown)}
          {shown == null ? null : <span className="quote-unit">{unit}</span>}
        </p>
        <p className="quote-change tnum">
          {amountText ? (
            <span className="quote-delta">
              {amountText}
              {percentText ? ` (${percentText})` : ""}
              <span className="sr-only"> {toneWord}</span>
            </span>
          ) : null}
          {meta ? (
            <span className="quote-meta">
              {amountText ? "· " : ""}
              {meta}
            </span>
          ) : null}
        </p>
      </div>

      <div
        ref={plotRef}
        className="quote-plot"
        data-no-pager=""
        data-pager-keys=""
        tabIndex={points.length > 1 ? 0 : undefined}
        role="img"
        aria-label={chartLabel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={onPointerLeave}
        onKeyDown={onKeyDown}
        onBlur={() => setScrub(null)}
      >
        {points.length >= 2 && geometry ? (
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
                <circle
                  cx={activeCoord.x}
                  cy={activeCoord.y}
                  r="3.25"
                  fill="var(--quote-ink)"
                />
              </g>
            ) : null}
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
            {geometry.labels.map((label) => (
              <text
                key={`${label.x}-${label.text}`}
                x={label.anchor === "start" ? label.x + 2 : label.anchor === "end" ? label.x - 2 : label.x}
                y={box.h - 4}
                className="quote-tick"
                textAnchor={label.anchor as "start" | "middle" | "end"}
              >
                {label.text}
              </text>
            ))}
          </svg>
        ) : (
          <p className="quote-plot-note">
            {history === undefined
              ? "Loading…"
              : points.length === 1
                ? "One session in this range."
                : series.length === 0
                  ? "No sessions yet. Log a working set and the estimate builds here."
                  : "No sessions in this range."}
          </p>
        )}
      </div>

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
            aria-selected={range === item.id}
            onClick={() => {
              setRange(item.id);
              setScrub(null);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {sessions.length > 0 ? (
        <div className="quote-sessions">
          {titled ? <h3>Sessions</h3> : <h2>Sessions</h2>}
          <ul>
            {sessions.map(({ session, sets }) => {
              const plates = sessionBreakdown(sets, unit);
              return (
                <li key={session.id} className="quote-session">
                  <span className="min-w-0">
                    <span className="tnum quote-sets">
                      {sets
                        .map((set) => formatSet(set, (lb) => toDisplay(lb, unit)))
                        .join(" · ")}
                    </span>
                    {plates ? (
                      <span className="tnum quote-plates">{plates}</span>
                    ) : null}
                  </span>
                  <span className="tnum quote-when">{sessionDate(session.date)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
