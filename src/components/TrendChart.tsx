import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface DualTrendPoint {
  date: string;
  weight?: number | null;
  calories?: number | null;
}

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
}

const AXIS_TICK = { fill: "#8a8a8a", fontSize: 11 } as const;

export function TrendChart({
  data,
  height = 160,
  sparkline = false,
  valueLabel,
}: TrendChartProps) {
  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-md border border-hairline bg-surface text-[13px] text-muted"
        style={{ height }}
      >
        Not enough sessions yet — log two to see a trend
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
              `${Math.round(Number(value)).toLocaleString()}${valueLabel ? ` ${valueLabel}` : ""}`,
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

interface DualTrendChartProps {
  data: DualTrendPoint[];
  height?: number;
  weightLabel: string;
}

const TOOLTIP_STYLE = {
  background: "#141414",
  border: "1px solid #232323",
  borderRadius: 8,
  fontSize: 13,
  color: "#fafafa",
} as const;

export function DualTrendChart({
  data,
  height = 200,
  weightLabel,
}: DualTrendChartProps) {
  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-md border border-hairline bg-surface px-4 text-center text-[13px] leading-relaxed text-muted"
        style={{ height }}
      >
        Log two days to see a trend
      </div>
    );
  }

  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          >
            <XAxis
              dataKey="date"
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="weight"
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={40}
              domain={["auto", "auto"]}
            />
            <YAxis
              yAxisId="calories"
              orientation="right"
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={44}
              domain={["auto", "auto"]}
            />
            <Tooltip
              cursor={{ stroke: "#232323", strokeWidth: 1 }}
              contentStyle={TOOLTIP_STYLE}
              labelStyle={{ color: "#8a8a8a" }}
              formatter={(value, name) => {
                if (value == null) return ["—", String(name)];
                const n = Number(value);
                if (name === "Calories") {
                  return [`${Math.round(n).toLocaleString()} kcal`, "Calories"];
                }
                return [`${n.toFixed(1)} ${weightLabel}`, "Weight"];
              }}
            />
            <Line
              yAxisId="weight"
              type="monotone"
              dataKey="weight"
              name="Weight"
              stroke="#d4d4d4"
              strokeWidth={1.5}
              connectNulls
              dot={false}
              activeDot={{ r: 3, fill: "#d4d4d4", strokeWidth: 0 }}
              isAnimationActive={false}
            />
            <Line
              yAxisId="calories"
              type="monotone"
              dataKey="calories"
              name="Calories"
              stroke="#8a8a8a"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              connectNulls
              dot={false}
              activeDot={{ r: 3, fill: "#8a8a8a", strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1 text-[13px] text-muted">
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-px w-5 bg-accent"
          />
          Weight ({weightLabel})
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block w-5 border-t border-dashed border-muted"
          />
          Calories
        </span>
      </div>
    </div>
  );
}
