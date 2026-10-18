import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import {
  contributionLevel,
  type ContributionCalendar,
} from "../lib/history";

const DOW = ["", "Mon", "", "Wed", "", "Fri", ""] as const;

function tipText(date: Date, sets: number): string {
  const when = date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  if (sets <= 0) return `No sets on ${when}`;
  return `${sets} ${sets === 1 ? "set" : "sets"} on ${when}`;
}

function neighborKey(
  calendar: ContributionCalendar,
  key: string,
  delta: number | "home" | "end",
): string | null {
  const days = calendar.columns.flatMap((column) =>
    column.days.filter((day) => day.counts),
  );
  if (delta === "home") return days[0]?.key ?? null;
  if (delta === "end") return days[days.length - 1]?.key ?? null;
  const index = days.findIndex((day) => day.key === key);
  if (index < 0) return null;
  return days[index + delta]?.key ?? null;
}

export function ContributionGraph({
  calendar,
  setsByDay,
  selectedKey,
  onSelect,
}: {
  calendar: ContributionCalendar;
  setsByDay: Map<string, number>;
  selectedKey: string;
  onSelect: (key: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{
    text: string;
    left: number;
    top: number;
    below: boolean;
  } | null>(null);

  useLayoutEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const selected = root.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!selected) {
      root.scrollLeft = root.scrollWidth;
      return;
    }
    const rootRect = root.getBoundingClientRect();
    const rect = selected.getBoundingClientRect();
    root.scrollLeft = Math.max(0, root.scrollLeft + (rect.right - rootRect.right) + 4);
  }, [calendar.startKey, calendar.endKey]);

  const showTip = (element: HTMLElement, date: Date, sets: number) => {
    const rect = element.getBoundingClientRect();
    const below = rect.top < 48;
    const center = rect.left + rect.width / 2;
    setTip({
      text: tipText(date, sets),
      left: Math.min(window.innerWidth - 96, Math.max(96, center)),
      top: below ? rect.bottom + 8 : rect.top - 8,
      below,
    });
  };

  const selectedInView = calendar.columns.some((column) =>
    column.days.some((day) => day.counts && day.key === selectedKey),
  );
  const tabKey = selectedInView ? selectedKey : calendar.endKey;

  const move = (key: string, delta: number | "home" | "end") => {
    const next = neighborKey(calendar, key, delta);
    if (!next) return;
    onSelect(next);
    requestAnimationFrame(() => {
      scrollerRef.current
        ?.querySelector<HTMLButtonElement>(`[data-date="${next}"]`)
        ?.focus();
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const key = (event.target as HTMLElement).dataset.date;
    if (!key) return;
    const delta =
      event.key === "ArrowLeft"
        ? -7
        : event.key === "ArrowRight"
          ? 7
          : event.key === "ArrowUp"
            ? -1
            : event.key === "ArrowDown"
              ? 1
              : event.key === "Home"
                ? "home"
                : event.key === "End"
                  ? "end"
                  : null;
    if (delta == null) return;
    event.preventDefault();
    move(key, delta);
  };

  return (
    <div className="contrib">
      <div className="contrib-split">
        <div className="contrib-dow-col" aria-hidden="true">
          <div className="contrib-dow-spacer" />
          <div className="contrib-dow">
            {DOW.map((label, index) => (
              <span key={index}>{label}</span>
            ))}
          </div>
        </div>
        <div
          ref={scrollerRef}
          className="contrib-scroll"
          onScroll={() => setTip(null)}
        >
          <div
            className="contrib-month-track"
            aria-hidden="true"
            style={{ "--weeks": String(calendar.columns.length) } as CSSProperties}
          >
            {calendar.months.map((month) => (
              <span
                key={`${month.column}-${month.label}`}
                className="contrib-month"
                style={{ gridColumn: month.column + 1 }}
              >
                {month.label}
              </span>
            ))}
          </div>
          <div
            role="grid"
            aria-label="Sets by day"
            className="contrib-grid"
            onKeyDown={onKeyDown}
          >
            {calendar.columns.map((column, columnIndex) =>
              column.days.map((day, row) => {
                if (!day.counts) {
                  return (
                    <span
                      key={day.key}
                      className="contrib-pad"
                      aria-hidden="true"
                    />
                  );
                }
                const sets = setsByDay.get(day.key) ?? 0;
                const selected = day.key === selectedKey;
                return (
                  <button
                    key={day.key}
                    type="button"
                    role="gridcell"
                    data-date={day.key}
                    data-level={contributionLevel(sets)}
                    aria-rowindex={row + 1}
                    aria-colindex={columnIndex + 1}
                    aria-pressed={selected}
                    aria-label={tipText(day.date, sets)}
                    tabIndex={day.key === tabKey ? 0 : -1}
                    className="contrib-cell"
                    onClick={() => onSelect(day.key)}
                    onMouseEnter={(event) => showTip(event.currentTarget, day.date, sets)}
                    onMouseLeave={() => setTip(null)}
                    onFocus={(event) => showTip(event.currentTarget, day.date, sets)}
                    onBlur={() => setTip(null)}
                  />
                );
              }),
            )}
          </div>
        </div>
      </div>
      <div className="contrib-legend">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span key={level} className="contrib-swatch" data-level={level} />
        ))}
        <span>More</span>
      </div>
      {tip ? (
        <div
          role="tooltip"
          className="contrib-tip"
          style={{
            left: tip.left,
            top: tip.top,
            transform: tip.below
              ? "translate(-50%, 0)"
              : "translate(-50%, -100%)",
          }}
        >
          {tip.text}
        </div>
      ) : null}
    </div>
  );
}
