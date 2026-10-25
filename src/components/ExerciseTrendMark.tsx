import { useLiveQuery } from "dexie-react-hooks";
import { trendTone } from "../lib/quoteSeries";
import { useUnit } from "../lib/settings";
import { toDisplay } from "../lib/units";
import { bestWorkingEstimate, exerciseHistory } from "../lib/workout";

/**
 * Recent direction for one lift: the two newest prior sessions, excluding
 * the open one so logging today does not flip the mark.
 */
export function ExerciseTrendMark({
  exerciseId,
  excludeSessionId,
}: {
  exerciseId: string;
  excludeSessionId?: string | null;
}) {
  const [unit] = useUnit();
  const tone = useLiveQuery(async () => {
    const history = await exerciseHistory(exerciseId, {
      excludeSessionId: excludeSessionId ?? undefined,
    });
    const prints: number[] = [];
    for (const entry of history) {
      const estimate = bestWorkingEstimate(entry.sets);
      if (estimate <= 0) continue;
      prints.push(Math.round(toDisplay(estimate, unit)));
      if (prints.length === 2) break;
    }
    if (prints.length < 2) return null;
    return trendTone(prints[1], prints[0]);
  }, [exerciseId, excludeSessionId, unit]);

  if (tone !== "up" && tone !== "down") return null;

  const down = tone === "down";
  return (
    <span className={down ? "trend-mark trend-mark-down" : "trend-mark"}>
      <svg viewBox="0 0 12 12" className="trend-mark-arrow" aria-hidden="true">
        {down ? (
          <path d="M3.15 3.15 8.85 8.85M5.15 8.85h3.7V5.15" />
        ) : (
          <path d="M3.15 8.85 8.85 3.15M5.15 3.15h3.7v3.7" />
        )}
      </svg>
      <span className="sr-only">{down ? "Trending down" : "Trending up"}</span>
    </span>
  );
}
