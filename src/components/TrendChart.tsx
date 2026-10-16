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
  /** Session index. Present when the axis can be scaled. */
  i?: number;
}

interface TrendChartProps {
  data: TrendPoint[];
  height?: number;
  /** Sparkline mode hides axes entirely. */
  sparkline?: boolean;
  /** Explicit windows. Points outside them clip, so a slider can scale one axis. */
  xDomain?: [number, number];
  yDomain?: [number, number];
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
  xDomain,
  yDomain,
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

  const scalable = xDomain != null && data.every((point) => point.i != null);

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: sparkline ? 8 : 0 }}
        >
          {!sparkline &&
            (scalable ? (
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
                minTickGap={5}
              />
            ))}
          {!sparkline && (
            <YAxis
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={44}
              tickCount={scalable ? 3 : 5}
              domain={yDomain ?? ["auto", "auto"]}
              allowDataOverflow={yDomain != null}
              niceTicks={yDomain ? "none" : "auto"}
            />
          )}
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
            stroke="var(--color-accent)"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={false}
            activeDot={{ r: 3, fill: "var(--color-accent)", strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
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
