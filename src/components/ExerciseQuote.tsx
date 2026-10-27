import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { LoadBreakdown, SetLog } from "../db/db";
import { useUnit } from "../lib/settings";
import { toDisplay, type Unit } from "../lib/units";
import {
  filterRange,
  formatPercent,
  formatQuoteDate,
  inRange,
  quoteDelta,
  signedNumber,
  type QuotePoint,
  type QuoteRangeId,
} from "../lib/quoteSeries";
import { QuotePlot, QuoteRanges } from "./QuotePlot";
import { bestWorkingEstimate, exerciseHistory, formatSet, formatWeight } from "../lib/workout";

function sessionDate(iso: string) {
  return formatQuoteDate(iso);
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

      <QuotePlot
        points={points}
        scrub={scrub}
        onScrub={setScrub}
        label={chartLabel}
        empty={
          <p className="quote-plot-note">
            {history === undefined
              ? "Loading…"
              : points.length === 1
                ? "One session in this range."
                : series.length === 0
                  ? "No sessions yet. Log a working set and the estimate builds here."
                  : "No sessions in this range."}
          </p>
        }
      />

      <QuoteRanges
        value={range}
        onChange={(next) => {
          setRange(next);
          setScrub(null);
        }}
      />

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
