/** Time windows for the exercise quote, in the stocks range order. */
export const QUOTE_RANGES = [
  { id: "1W", label: "1W", days: 7 },
  { id: "1M", label: "1M", days: 31 },
  { id: "3M", label: "3M", days: 92 },
  { id: "6M", label: "6M", days: 183 },
  { id: "YTD", label: "YTD", days: null },
  { id: "1Y", label: "1Y", days: 365 },
  { id: "2Y", label: "2Y", days: 730 },
  { id: "5Y", label: "5Y", days: 1825 },
  { id: "ALL", label: "All", days: null },
] as const;

export type QuoteRangeId = (typeof QUOTE_RANGES)[number]["id"];

export interface QuotePoint {
  /** Session time, ms. */
  t: number;
  /** Estimated 1RM in display units. */
  value: number;
  label: string;
}

export type QuoteTone = "up" | "down" | "flat";

export interface QuoteDelta {
  tone: QuoteTone;
  amount: number;
  /** Null when the window opens at zero and a percent would be meaningless. */
  percent: number | null;
}

/** Inclusive start of a window. Null means the full history. */
export function rangeStart(id: QuoteRangeId, now: Date): number | null {
  if (id === "ALL") return null;
  if (id === "YTD") return new Date(now.getFullYear(), 0, 1).getTime();
  const spec = QUOTE_RANGES.find((range) => range.id === id);
  const days = spec?.days ?? 0;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days);
  return start.getTime();
}

export function inRange(t: number, id: QuoteRangeId, now = new Date()): boolean {
  const start = rangeStart(id, now);
  return start == null || t >= start;
}

/** Points inside the window, oldest first. `points` must already be oldest first. */
export function filterRange(
  points: QuotePoint[],
  id: QuoteRangeId,
  now = new Date(),
): QuotePoint[] {
  return points.filter((point) => inRange(point.t, id, now));
}

/**
 * Change from the first print in the window to the last.
 * A move under 0.05 display units reads as flat so rounding does not flicker.
 */
export function quoteDelta(points: QuotePoint[]): QuoteDelta | null {
  if (points.length === 0) return null;
  const first = points[0].value;
  const last = points[points.length - 1].value;
  const amount = last - first;
  const percent = first !== 0 ? (amount / Math.abs(first)) * 100 : null;
  const tone: QuoteTone =
    Math.abs(amount) < 0.05 ? "flat" : amount > 0 ? "up" : "down";
  return { tone, amount, percent };
}

/**
 * Direction from an older print to a newer one.
 * A flat move, and a window with nothing to compare, stay quiet.
 */
export function trendTone(older: number, newer: number): Exclude<QuoteTone, "flat"> | null {
  const delta = quoteDelta([
    { t: 0, value: older, label: "" },
    { t: 1, value: newer, label: "" },
  ]);
  if (!delta || delta.tone === "flat") return null;
  return delta.tone;
}

export function paddedDomain(values: number[], padRatio = 0.12): [number, number] {
  if (values.length === 0) return [0, 1];
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max - min < 1e-6) {
    const pad = Math.max(1, Math.abs(max) * 0.06);
    return [min - pad, max + pad];
  }
  const pad = (max - min) * padRatio;
  return [min - pad, max + pad];
}

export interface CurvePoint {
  x: number;
  y: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Fritsch–Carlson monotone cubic. The curve stays between neighboring
 * samples, so an estimate never visually overshoots a session.
 */
export function monotoneCurve(points: CurvePoint[]): string {
  const n = points.length;
  if (n < 2) return "";
  if (n === 2) {
    return `M ${r2(points[0].x)} ${r2(points[0].y)} L ${r2(points[1].x)} ${r2(points[1].y)}`;
  }

  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const h = points[i + 1].x - points[i].x;
    dx[i] = h;
    slope[i] = h === 0 ? 0 : (points[i + 1].y - points[i].y) / h;
  }

  const tangent = new Array<number>(n).fill(0);
  tangent[0] = slope[0];
  tangent[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    tangent[i] =
      slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  }

  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(slope[i]) < 1e-9) {
      tangent[i] = 0;
      tangent[i + 1] = 0;
      continue;
    }
    const a = tangent[i] / slope[i];
    const b = tangent[i + 1] / slope[i];
    const sum = a * a + b * b;
    if (sum > 9) {
      const scale = 3 / Math.sqrt(sum);
      tangent[i] = scale * a * slope[i];
      tangent[i + 1] = scale * b * slope[i];
    }
  }

  let d = `M ${r2(points[0].x)} ${r2(points[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i];
    const c1x = points[i].x + h / 3;
    const c1y = points[i].y + (tangent[i] * h) / 3;
    const c2x = points[i + 1].x - h / 3;
    const c2y = points[i + 1].y - (tangent[i + 1] * h) / 3;
    d += ` C ${r2(c1x)} ${r2(c1y)} ${r2(c2x)} ${r2(c2y)} ${r2(points[i + 1].x)} ${r2(points[i + 1].y)}`;
  }
  return d;
}

/** Close a curve down to the plot floor so the wash sits under the line. */
export function areaUnder(line: string, left: number, right: number, floor: number): string {
  if (!line) return "";
  return `${line} L ${r2(right)} ${r2(floor)} L ${r2(left)} ${r2(floor)} Z`;
}

/** Ledger sign. A flat change has no sign. */
export function signedNumber(value: number, body: string): string {
  if (value > 0) return `+${body}`;
  if (value < 0) return `−${body}`;
  return body;
}

export function formatPercent(percent: number): string {
  const body = Math.abs(percent).toFixed(1);
  return signedNumber(percent, `${body}%`);
}

/** Short session date. The year appears only when it is not the current one. */
export function formatQuoteDate(isoOrMs: string | number, now = new Date()): string {
  const date = new Date(isoOrMs);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}
