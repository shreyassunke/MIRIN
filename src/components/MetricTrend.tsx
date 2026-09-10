import { useRef, useState } from "react";
import { useSwipe } from "../hooks/useSwipe";
import { shortDate } from "../lib/history";
import {
  formatDelta,
  type MetricGroup,
  type MetricGroupId,
  type MetricSeries,
} from "../lib/metrics";
import { chipClass, chipTrackClass } from "./chip";
import { TrendChart, type TrendPoint } from "./TrendChart";

const CHART_HEIGHT = 200;

const EMPTY_COPY: Record<MetricGroupId, string> = {
  daily: "Log a day to see a trend.",
  measurements: "Log a field on two separate days to see its trend.",
  derived: "Derived metrics need height, weight, and tape readings.",
};

/** What the number has done across the readings on screen. */
function deltaLine(metric: MetricSeries): string {
  const { points } = metric;
  if (points.length < 2) return "One reading so far";
  const change = points[points.length - 1].value - points[0].value;
  const since = shortDate(points[0].dateKey);
  if (change === 0) return `No change since ${since}`;
  return `${formatDelta(metric, change)} since ${since}`;
}

/**
 * One chart, pointed at any metric. The group switch is the coarse move and
 * the rail (or a swipe across the plot) is the fine one, so the numbers stay
 * the largest thing on screen.
 */
export function MetricTrend({
  groups,
  loading = false,
}: {
  groups: MetricGroup[];
  loading?: boolean;
}) {
  const [pickedGroup, setPickedGroup] = useState<MetricGroupId | null>(null);
  const [pickedMetric, setPickedMetric] = useState<
    Partial<Record<MetricGroupId, string>>
  >({});
  const railRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Open on something worth reading rather than on an empty Daily group.
  const firstStocked = groups.find((g) => g.metrics.length > 0);
  const group =
    groups.find((g) => g.id === pickedGroup) ?? firstStocked ?? groups[0];

  const metrics = group?.metrics ?? [];
  const metric =
    metrics.find((m) => m.id === pickedMetric[group?.id as MetricGroupId]) ??
    metrics[0] ??
    null;
  const index = metric ? metrics.indexOf(metric) : -1;

  const select = (next: number, moveFocus = false) => {
    if (!group || metrics.length === 0) return;
    const wrapped = (next + metrics.length) % metrics.length;
    setPickedMetric((prev) => ({ ...prev, [group.id]: metrics[wrapped].id }));
    if (moveFocus) railRefs.current[wrapped]?.focus();
  };

  const swipe = useSwipe({
    onPrev: () => select(index - 1),
    onNext: () => select(index + 1),
    enabled: metrics.length > 1,
  });

  const points: TrendPoint[] =
    metric?.points.map((p) => ({
      date: shortDate(p.dateKey),
      value: p.value,
    })) ?? [];

  return (
    <section aria-labelledby="log-trend">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="log-trend" className="text-[13px] font-medium text-muted">
          Trend
        </h2>
        <div
          role="group"
          aria-label="Metric group"
          className={chipTrackClass}
        >
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              aria-pressed={g.id === group?.id}
              onClick={() => setPickedGroup(g.id)}
              className={`${chipClass(g.id === group?.id)} h-9 px-3.5 text-[13px]`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div
          className="flex items-center justify-center rounded-md border border-hairline bg-surface text-[13px] text-muted"
          style={{ height: CHART_HEIGHT }}
        >
          Loading…
        </div>
      ) : !metric ? (
        <div
          className="flex items-center justify-center rounded-md border border-hairline bg-surface px-4 text-center text-[13px] leading-relaxed text-muted"
          style={{ height: CHART_HEIGHT }}
        >
          {EMPTY_COPY[group?.id ?? "daily"]}
        </div>
      ) : (
        <>
          <div className="mb-1 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold tracking-tight text-ink">
                {metric.label}
              </p>
              <p className="tnum mt-0.5 text-[13px] text-muted">
                {deltaLine(metric)}
              </p>
            </div>
            <p className="tnum shrink-0 text-xl font-semibold tracking-tight text-ink">
              {metric.format(metric.points[metric.points.length - 1].value)}
            </p>
          </div>

          <div key={metric.id} className="fade-in" {...swipe}>
            <TrendChart
              data={points}
              height={CHART_HEIGHT}
              formatValue={metric.format}
              emptyLabel={`One reading so far — log ${metric.label.toLowerCase()} on another day to see a trend`}
            />
          </div>

          {metrics.length > 1 ? (
            <div
              role="group"
              aria-label="Metric"
              className="mt-1 flex flex-wrap justify-center"
              onKeyDown={(event) => {
                if (event.key === "ArrowRight") select(index + 1, true);
                else if (event.key === "ArrowLeft") select(index - 1, true);
                else return;
                event.preventDefault();
              }}
            >
              {metrics.map((m, i) => (
                <button
                  key={m.id}
                  type="button"
                  ref={(el) => {
                    railRefs.current[i] = el;
                  }}
                  aria-pressed={m.id === metric.id}
                  aria-label={m.label}
                  onClick={() => select(i)}
                  className="group flex h-11 w-7 items-center justify-center rounded-md"
                >
                  <span
                    aria-hidden="true"
                    className={[
                      "h-1.5 rounded-pill transition-all duration-[160ms] ease-out-expo",
                      m.id === metric.id
                        ? "w-4 bg-ink"
                        : "w-1.5 bg-muted/50 group-hover:bg-muted",
                    ].join(" ")}
                  />
                </button>
              ))}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
