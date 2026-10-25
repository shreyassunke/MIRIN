/** Least-squares line through the series. x is the session index. */
export function fitLine(points: { value: number; i?: number }[]): number[] {
  const n = points.length;
  if (n === 0) return [];
  if (n === 1) return [points[0].value];

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let index = 0; index < n; index++) {
    const x = points[index].i ?? index;
    const y = points[index].value;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) {
    const mean = sumY / n;
    return points.map(() => mean);
  }

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return points.map((point, index) => intercept + slope * (point.i ?? index));
}
