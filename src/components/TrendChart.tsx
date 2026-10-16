import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface TrendPoint {
  date: string; // short display label
  value: number;
}

interface TrendChartProps {
  data: TrendPoint[];
  height?: number;
  /** Sparkline mode hides axes entirely. */
  sparkline?: boolean;
  /**
   * Full-bleed field behind another subject. The plot does not capture
   * pointers. `reserveTop` keeps a caption clear of the line.
   */
  ground?: boolean;
  reserveTop?: number;
  valueLabel?: string;
  /** Takes over tooltip text when a metric carries its own units. */
  formatValue?: (value: number) => string;
  /** Shown in place of the plot when there is not enough to draw. */
  emptyLabel?: string;
}

// The Ledger Rule reaches the axis too: these numerals get compared.
const AXIS_TICK = {
  fill: "var(--color-muted)",
  fontSize: 11,
  fontVariantNumeric: "tabular-nums",
} as const;

export function TrendChart({
  data,
  height = 160,
  sparkline = false,
  ground = false,
  reserveTop = 72,
  valueLabel,
  formatValue,
  emptyLabel = "Not enough sessions yet — log two to see a trend",
}: TrendChartProps) {
  if (data.length < 2) {
    if (ground) return null;
    return (
      <div
        className="flex items-center justify-center rounded-md border border-hairline bg-surface px-4 text-center text-[13px] leading-relaxed text-muted"
        style={{ height }}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div
      className={ground ? "h-full min-h-0 w-full" : undefined}
      style={ground ? undefined : { height }}
      data-trend-ground={ground ? "" : undefined}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={
            ground
              ? { top: reserveTop, right: 8, bottom: 0, left: 0 }
              : { top: 8, right: 8, bottom: 0, left: sparkline ? 8 : 0 }
          }
        >
          {!sparkline && (
            <XAxis
              dataKey="date"
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={ground ? 28 : 5}
            />
          )}
          {!sparkline && (
            <YAxis
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={ground ? 40 : 44}
              tickCount={ground ? 3 : 5}
              domain={["auto", "auto"]}
            />
          )}
          {!ground && (
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
              formatter={(value) => [
                formatValue
                  ? formatValue(Number(value))
                  : `${Math.round(Number(value)).toLocaleString()}${valueLabel ? ` ${valueLabel}` : ""}`,
                "",
              ]}
              separator=""
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--color-accent)"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={false}
            activeDot={
              ground
                ? false
                : { r: 3, fill: "var(--color-accent)", strokeWidth: 0 }
            }
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
