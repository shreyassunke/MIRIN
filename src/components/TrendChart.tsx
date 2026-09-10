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
  valueLabel?: string;
  /** Takes over tooltip text when a metric carries its own units. */
  formatValue?: (value: number) => string;
  /** Shown in place of the plot when there is not enough to draw. */
  emptyLabel?: string;
}

// The Ledger Rule reaches the axis too: these numerals get compared.
const AXIS_TICK = {
  fill: "#8a8a8a",
  fontSize: 11,
  fontVariantNumeric: "tabular-nums",
} as const;

export function TrendChart({
  data,
  height = 160,
  sparkline = false,
  valueLabel,
  formatValue,
  emptyLabel = "Not enough sessions yet — log two to see a trend",
}: TrendChartProps) {
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

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: sparkline ? 8 : 0 }}
        >
          {!sparkline && (
            <XAxis
              dataKey="date"
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
          )}
          {!sparkline && (
            <YAxis
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={44}
              domain={["auto", "auto"]}
            />
          )}
          <Tooltip
            cursor={{ stroke: "#232323", strokeWidth: 1 }}
            contentStyle={{
              background: "#141414",
              border: "1px solid #232323",
              borderRadius: 8,
              fontSize: 13,
              color: "#fafafa",
            }}
            labelStyle={{ color: "#8a8a8a" }}
            formatter={(value) => [
              formatValue
                ? formatValue(Number(value))
                : `${Math.round(Number(value)).toLocaleString()}${valueLabel ? ` ${valueLabel}` : ""}`,
              "",
            ]}
            separator=""
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#d4d4d4"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: "#d4d4d4", strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
