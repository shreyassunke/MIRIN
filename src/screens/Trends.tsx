import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type SetLog, type WorkoutSession } from "../db/db";
import { setVolume } from "../lib/workout";
import { toDisplay, type Unit } from "../lib/units";
import { useUnit } from "../lib/settings";
import { Physique } from "../components/physique/Physique";
import type { PhysiqueControl, PhysiqueGesture, Slot } from "../components/physique/gesture";
import { QuotePlot, QuoteRanges } from "../components/QuotePlot";
import {
  filterRange,
  formatPercent,
  formatQuoteDate,
  quoteDelta,
  signedNumber,
  type QuotePoint,
  type QuoteRangeId,
} from "../lib/quoteSeries";
import {
  REGION_LABEL,
  regionIntensities,
  volumeByRegion,
  type RegionId,
} from "../lib/muscleRegions";

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

function formatVolume(value: number) {
  return Math.round(value).toLocaleString();
}

function volumeSeries(
  sessions: WorkoutSession[],
  unit: Unit,
  bySession: Map<string, number>,
): QuotePoint[] {
  return sessions
    .filter((session) => session.completed && bySession.has(session.id))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((session) => ({
      t: new Date(session.date).getTime(),
      value: Math.round(toDisplay(bySession.get(session.id)!, unit)),
      label: formatQuoteDate(session.date),
    }));
}

function overallBySession(logs: SetLog[]): Map<string, number> {
  const bySession = new Map<string, number>();
  for (const log of logs) {
    bySession.set(log.sessionId, (bySession.get(log.sessionId) ?? 0) + setVolume(log));
  }
  return bySession;
}

export function Trends() {
  const [unit] = useUnit();
  const [picked, setPicked] = useState<RegionId | null>(null);
  const [range, setRange] = useState<QuoteRangeId>("ALL");
  const [scrub, setScrub] = useState<number | null>(null);
  const gestureRef = useRef<PhysiqueGesture | null>(null) as Slot<PhysiqueGesture | null>;
  const controlRef = useRef<PhysiqueControl | null>(null) as Slot<PhysiqueControl | null>;
  const data = useLiveQuery(async () => {
    const [sessions, logs, exercises] = await Promise.all([
      db.sessions.toArray(),
      db.setLogs.toArray(),
      db.exercises.toArray(),
    ]);
    return { sessions, logs, exercises };
  }, []);

  const volumes = useMemo(
    () => (data ? volumeByRegion(data.sessions, data.logs, data.exercises) : null),
    [data],
  );
  const intensities = useMemo(
    () => (volumes ? regionIntensities(volumes) : null),
    [volumes],
  );

  const region = volumes && picked ? volumes[picked] : null;
  const series = useMemo(() => {
    if (!data) return [];
    const bySession = region ? region.bySession : overallBySession(data.logs);
    return volumeSeries(data.sessions, unit, bySession);
  }, [data, region, unit]);
  const points = useMemo(() => filterRange(series, range), [series, range]);

  useEffect(() => {
    setScrub(null);
  }, [picked, range, unit]);

  const focus = scrub != null ? points[scrub] : points[points.length - 1];
  const delta = quoteDelta(focus && points.length > 0 ? [points[0], focus] : points);
  const tone = delta?.tone ?? "flat";
  const shown = focus?.value;
  const amountText =
    delta && points.length > 1
      ? signedNumber(delta.amount, formatVolume(Math.abs(delta.amount)))
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
          ? (focus?.label ?? "")
          : "";
  const title = picked ? REGION_LABEL[picked] : "Overall volume";
  const chartLabel =
    shown == null
      ? `${title} per completed session`
      : `${title} ${formatVolume(shown)} ${unit}, ${toneWord}${
          amountText ? ` ${amountText}` : ""
        }, ${RANGE_PHRASE[range].toLowerCase()}`;
  const contributors = region?.contributors ?? [];
  const hasAny = (data?.logs.length ?? 0) > 0;

  if (!data || !volumes || !intensities) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  return (
    <section
      className="exercise-quote volume-quote"
      data-tone={shown == null ? "flat" : tone}
      data-physique-metric=""
    >
      <header className="quote-title">
        <h2>{title}</h2>
      </header>

      <div className="quote-readout">
        <p className="quote-label">Per completed session</p>
        <p className="quote-value tnum">
          {shown == null ? "—" : formatVolume(shown)}
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
        figureRef={gestureRef}
        controlRef={controlRef}
        empty={
          <p className="quote-plot-note">
            {points.length === 1 ? (
              "One session in this range."
            ) : series.length > 0 ? (
              "No sessions in this range."
            ) : !hasAny ? (
              <>
                Nothing to chart yet. Progress appears after a completed session on{" "}
                <Link to="/today" className="font-medium text-ink">
                  Today
                </Link>
                .
              </>
            ) : picked ? (
              `No ${title.toLowerCase()} volume yet.`
            ) : (
              "Not enough sessions yet. Log two to see a trend."
            )}
          </p>
        }
        overlay={
          <div className="volume-figure">
            <Physique
              intensities={intensities}
              selected={picked}
              onSelect={setPicked}
              gestureRef={gestureRef}
              controlRef={controlRef}
            />
          </div>
        }
      />

      <QuoteRanges
        value={range}
        onChange={(next) => {
          setRange(next);
          setScrub(null);
        }}
      />

      {contributors.length > 0 ? (
        <div className="quote-sessions">
          <h3>Exercises</h3>
          <ul>
            {contributors.map((lift) => (
              <li key={lift.id}>
                <Link to={`/exercise/${lift.id}`} className="quote-session">
                  <span className="quote-sets min-w-0 truncate">{lift.name}</span>
                  <span className="tnum quote-when">
                    {formatVolume(toDisplay(lift.volume, unit))} {unit}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
