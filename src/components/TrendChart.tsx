import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type DotItemDotProps,
} from "recharts";
import type { ChartReadingId } from "./ChartReading";
import { fitLine } from "../lib/trendLine";

export interface TrendPoint {
  date: string; // short display label
  value: number;
  /** Session index. Present when the axis can be scaled. */
  i?: number;
  /** Fitted line. Present only for the trend reading. */
  trend?: number;
}

interface TrendChartProps {
  data: TrendPoint[];
  height?: number | string;
  /** Sparkline mode hides axes entirely. */
  sparkline?: boolean;
  /** Explicit windows. Points outside them clip. */
  xDomain?: [number, number];
  yDomain?: [number, number];
  valueLabel?: string;
  /** Takes over tooltip text when a metric carries its own units. */
  formatValue?: (value: number) => string;
  /** Shown in place of the plot when there is not enough to draw. */
  emptyLabel?: string;
  /** How the same series is drawn. Sparkline stays a line. */
  variant?: ChartReadingId;
  /** Profile draws the series behind the figure, so the plot does not take hits. */
  interactive?: boolean;
  /** Quieter axis for a plot that shares its box with the figure. */
  yTicks?: number;
  /** Minimum pixels between date labels. */
  minTickGap?: number;
}

// The Ledger Rule reaches the axis too: these numerals get compared.
const AXIS_TICK = {
  fill: "var(--color-muted)",
  fontSize: 11,
  fontVariantNumeric: "tabular-nums",
} as const;

const SERIES_STROKE = {
  stroke: "var(--color-accent)",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  isAnimationActive: false,
};

export function TrendChart({
  data,
  height = 160,
  sparkline = false,
  xDomain,
  yDomain,
  valueLabel,
  formatValue,
  emptyLabel = "Not enough sessions yet — log two to see a trend",
  variant = "line",
  interactive = true,
  yTicks,
  minTickGap = 48,
}: TrendChartProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [hasBox, setHasBox] = useState(false);
  const plotted = useMemo(() => withTrend(data, variant), [data, variant]);

  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    if (el.clientWidth > 0 && el.clientHeight > 0) {
      setHasBox(true);
      return;
    }
    if (typeof ResizeObserver === "undefined") {
      setHasBox(true);
      return;
    }
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect && rect.width > 0 && rect.height > 0) {
        setHasBox(true);
        ro.disconnect();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [data.length]);

  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-md border border-hairline bg-surface px-4 text-center text-[13px] leading-relaxed text-muted"
        style={{ height }}
      >
        {emptyLabel}
      </div>
    );
  }

  const scalable = xDomain != null && data.every((point) => point.i != null);
  const area = !sparkline && variant === "area";
  const last = plotted.length - 1;

  const endDot = (props: DotItemDotProps) => {
    const { cx, cy, index } = props;
    if (sparkline || index !== last || cx == null || cy == null) {
      return <g key={index} />;
    }
    return <circle key={index} cx={cx} cy={cy} r={2.5} fill="var(--color-accent)" />;
  };

  return (
    <div ref={hostRef} style={{ height }}>
      {hasBox ? (
        <ResponsiveContainer width="100%" height="100%">
          {sparkline ? (
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <Line
                type="monotone"
                dataKey="value"
                dot={false}
                activeDot={{ r: 3, fill: "var(--color-accent)", strokeWidth: 0 }}
                {...SERIES_STROKE}
              />
            </LineChart>
          ) : (
            <ComposedChart
              data={plotted}
              margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
            >
              {scalable ? (
                <XAxis
                  dataKey="i"
                  type="number"
                  domain={xDomain}
                  allowDataOverflow
                  niceTicks="none"
                  ticks={indexTicks(data, xDomain)}
                  tickFormatter={(value) =>
                    data.find((point) => point.i === Math.round(Number(value)))
                      ?.date ?? ""
                  }
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />
              ) : (
                <XAxis
                  dataKey="date"
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={minTickGap}
                />
              )}
              <YAxis
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                width={48}
                tickCount={yTicks ?? (yDomain ? 3 : 4)}
                domain={
                  area && yDomain == null ? [0, "auto"] : (yDomain ?? ["auto", "auto"])
                }
                allowDataOverflow={yDomain != null && !area}
                niceTicks={yDomain && !area ? "none" : "auto"}
              />
              {interactive ? (
                <Tooltip
                  cursor={{ stroke: "var(--color-hairline)", strokeWidth: 1 }}
                  contentStyle={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-hairline)",
                    borderRadius: 8,
                    fontSize: 13,
                    color: "var(--color-ink)",
                  }}
                  labelStyle={{ color: "var(--color-muted)" }}
                  labelFormatter={(label) =>
                    scalable
                      ? (data.find((point) => point.i === Math.round(Number(label)))
                          ?.date ?? String(label))
                      : String(label)
                  }
                  formatter={(value, name) =>
                    name === "trend"
                      ? [null, null]
                      : [
                          formatValue
                            ? formatValue(Number(value))
                            : `${Math.round(Number(value)).toLocaleString()}${valueLabel ? ` ${valueLabel}` : ""}`,
                          "",
                        ]
                  }
                  separator=""
                />
              ) : null}
              {variant === "trend" ? (
                <Line
                  type="linear"
                  dataKey="trend"
                  stroke="var(--color-muted)"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dot={false}
                  activeDot={false}
                  legendType="none"
                  isAnimationActive={false}
                />
              ) : null}
              {area ? (
                <Area
                  type="monotone"
                  dataKey="value"
                  fill="var(--color-accent)"
                  fillOpacity={0.14}
                  baseValue={0}
                  dot={endDot}
                  activeDot={
                    interactive
                      ? { r: 3, fill: "var(--color-accent)", strokeWidth: 0 }
                      : false
                  }
                  {...SERIES_STROKE}
                />
              ) : (
                <Line
                  type="monotone"
                  dataKey="value"
                  dot={endDot}
                  activeDot={
                    interactive
                      ? { r: 3, fill: "var(--color-accent)", strokeWidth: 0 }
                      : false
                  }
                  {...SERIES_STROKE}
                />
              )}
            </ComposedChart>
          )}
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}

function withTrend(data: TrendPoint[], variant: ChartReadingId): TrendPoint[] {
  if (variant !== "trend") return data;
  const trend = fitLine(data);
  return data.map((point, index) => ({ ...point, trend: trend[index] }));
}

function indexTicks(data: TrendPoint[], domain: [number, number]) {
  const visible = data
    .map((point) => point.i)
    .filter(
      (index): index is number =>
        index != null && index >= domain[0] && index <= domain[1],
    );
  if (visible.length <= 5) return visible;
  const step = Math.ceil(visible.length / 4);
  const ticks = visible.filter((_, index) => index % step === 0);
  const last = visible[visible.length - 1];
  if (ticks[ticks.length - 1] !== last) ticks.push(last);
  return ticks;
}
