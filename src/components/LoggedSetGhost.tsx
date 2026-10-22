import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent } from "react";
import type { SetDrop, SetLog } from "../db/db";
import { deleteSetDrop, deleteSetLog, updateSetDrop, updateSetLog } from "../lib/history";
import { MANUAL_STEP, toCanonical, toDisplay, type Unit } from "../lib/units";
import { formatWeight } from "../lib/workout";
import { Stepper } from "./Stepper";

const SWIPE_PX = 64;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function visibleLogPill(): HTMLElement | null {
  const docked = document.querySelector(".set-dock .log-pill");
  if (docked instanceof HTMLElement && docked.getBoundingClientRect().width > 0) {
    return docked;
  }
  const pills = document.querySelectorAll("[data-log-bar] .log-pill");
  for (const pill of pills) {
    if (!(pill instanceof HTMLElement)) continue;
    if (pill.closest("[inert]")) continue;
    const rect = pill.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) continue;
    if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
    return pill;
  }
  return null;
}

/** The logged pair leaves the pill and settles into its place on the line. */
function flyFromPill(node: HTMLElement) {
  if (prefersReducedMotion()) return;
  const pill = visibleLogPill();
  if (!pill) return;
  const from = pill.getBoundingClientRect();
  const to = node.getBoundingClientRect();
  if (from.width < 1 || to.width < 1) return;
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const scale = Math.min(1.85, Math.max(1.05, from.height / Math.max(to.height, 1)));
  node.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0.92 },
      { transform: "none", opacity: 1 },
    ],
    { duration: 280, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
  );
}

interface LoggedSetsProps {
  sets: SetLog[];
  unit: Unit;
}

/** The sets logged on this exercise, as one line. Newest sits at the end. */
export function LoggedSets({ sets, unit }: LoggedSetsProps) {
  const listRef = useRef<HTMLUListElement | null>(null);
  const printRef = useRef<HTMLLIElement | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const [printed, setPrinted] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [overflow, setOverflow] = useState(false);
  const signature = sets.map((set) => `${set.id}:${set.drops?.length ?? 0}`).join("|");

  useLayoutEffect(() => {
    const scroller = listRef.current;
    if (scroller) scroller.scrollLeft = scroller.scrollWidth;
    const sigs = signature.length > 0 ? signature.split("|") : [];
    if (seen.current === null) {
      seen.current = new Set(sigs);
      return;
    }
    const fresh = sigs.find((sig) => !seen.current!.has(sig));
    for (const sig of sigs) seen.current.add(sig);
    if (fresh) setPrinted(fresh);
  }, [signature]);

  useLayoutEffect(() => {
    if (!printed) return;
    const scroller = listRef.current;
    if (scroller) scroller.scrollLeft = scroller.scrollWidth;
    if (printRef.current) flyFromPill(printRef.current);
  }, [printed]);

  useLayoutEffect(() => {
    const node = listRef.current;
    if (!node) return;
    const sync = () => setOverflow(node.scrollWidth > node.clientWidth + 1);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(node);
    return () => observer.disconnect();
  }, [signature]);

  useEffect(() => {
    if (!editing) return;
    const onDown = (event: PointerEvent) => {
      const list = listRef.current;
      if (list && event.target instanceof Node && list.contains(event.target)) return;
      setEditing(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [editing]);

  if (sets.length === 0) {
    return <div className="ledger-reserve" aria-hidden="true" />;
  }

  return (
    <div className="ledger-block" data-ledger="">
      <ul
        ref={listRef}
        className={overflow ? "ledger is-overflow" : "ledger"}
        aria-label="Logged sets"
      >
        {sets.map((set) => {
          const sig = `${set.id}:${set.drops?.length ?? 0}`;
          return (
            <LedgerToken
              key={set.id}
              set={set}
              unit={unit}
              editing={editing === set.id}
              tokenRef={printed === sig ? printRef : undefined}
              onEdit={() => setEditing(set.id)}
            />
          );
        })}
      </ul>
    </div>
  );
}

function pairText(weight: number, reps: number, unit: Unit) {
  return `${formatWeight(toDisplay(weight, unit))} ${unit} by ${reps}`;
}

function Figures({ weight, reps, unit }: { weight: number; reps: number; unit: Unit }) {
  return (
    <>
      <span className="tnum">{formatWeight(toDisplay(weight, unit))}</span>
      <span className="ledger-times" aria-hidden="true">
        ×
      </span>
      <span className="tnum">{reps}</span>
    </>
  );
}

function PairEditors({
  weight,
  reps,
  unit,
  weightLabel,
  repsLabel,
  onWeight,
  onReps,
}: {
  weight: number;
  reps: number;
  unit: Unit;
  weightLabel: string;
  repsLabel: string;
  onWeight: (value: number) => void;
  onReps: (value: number) => void;
}) {
  const display = toDisplay(weight, unit);
  const [shownWeight, setShownWeight] = useState(display);
  const [shownReps, setShownReps] = useState(reps);
  useEffect(() => setShownWeight(display), [display]);
  useEffect(() => setShownReps(reps), [reps]);
  return (
    <>
      <Stepper
        label={weightLabel}
        value={shownWeight}
        step={MANUAL_STEP[unit]}
        min={0}
        layout="readout"
        size="compact"
        drag
        onChange={(value) => {
          setShownWeight(value);
          onWeight(value);
        }}
      />
      <span className="ledger-times" aria-hidden="true">
        ×
      </span>
      <Stepper
        label={repsLabel}
        value={shownReps}
        step={1}
        min={1}
        layout="readout"
        size="compact"
        drag
        onChange={(value) => {
          setShownReps(value);
          onReps(value);
        }}
      />
    </>
  );
}

function LedgerToken({
  set,
  unit,
  editing,
  tokenRef,
  onEdit,
}: {
  set: SetLog;
  unit: Unit;
  editing: boolean;
  tokenRef?: MutableRefObject<HTMLLIElement | null>;
  onEdit: () => void;
}) {
  const nodeRef = useRef<HTMLLIElement | null>(null);
  const skipClick = useRef(false);
  const shift = useRef(0);
  const swipe = useRef<{
    id: number;
    x: number;
    y: number;
    scroll: number;
    dragging: boolean;
  } | null>(null);
  const drops = set.drops ?? [];
  const name = set.isWarmup ? `Warm-up set ${set.setNumber}` : `Set ${set.setNumber}`;
  const detail = [
    pairText(set.weight, set.reps, unit),
    ...drops.map((drop) => pairText(drop.weight, drop.reps, unit)),
  ].join(", then ");
  const label = `${name}, ${detail}`;

  const paint = (px: number) => {
    shift.current = px;
    const node = nodeRef.current;
    if (!node) return;
    node.style.transform = px === 0 ? "" : `translate3d(${px}px, 0, 0)`;
  };

  const setNode = (node: HTMLLIElement | null) => {
    nodeRef.current = node;
    if (tokenRef) tokenRef.current = node;
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const scroller = event.currentTarget.closest(".ledger");
    swipe.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      scroll: scroller instanceof HTMLElement ? scroller.scrollLeft : 0,
      dragging: false,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = swipe.current;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const scroller = event.currentTarget.closest(".ledger");
    const scrolled =
      scroller instanceof HTMLElement && Math.abs(scroller.scrollLeft - start.scroll) > 2;
    if (scrolled) {
      start.dragging = false;
      paint(0);
      return;
    }
    if (!start.dragging) {
      if (Math.hypot(dx, dy) < 12) return;
      if (Math.abs(dx) <= Math.abs(dy)) {
        swipe.current = null;
        return;
      }
      start.dragging = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    paint(dx);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = swipe.current;
    if (!start || start.id !== event.pointerId) return;
    swipe.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!start.dragging) return;
    skipClick.current = true;
    if (Math.abs(shift.current) > SWIPE_PX) {
      void deleteSetLog(set.id);
      return;
    }
    const node = nodeRef.current;
    const from = shift.current;
    if (!node || prefersReducedMotion()) {
      paint(0);
      return;
    }
    const anim = node.animate(
      [{ transform: `translate3d(${from}px, 0, 0)` }, { transform: "none" }],
      { duration: 160, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
    );
    anim.onfinish = () => paint(0);
  };

  return (
    <li
      ref={setNode}
      className={set.isWarmup ? "ledger-item is-warmup" : "ledger-item"}
    >
      {editing ? (
        <div className="ledger-edit" role="group" aria-label={label}>
          <PairEditors
            weight={set.weight}
            reps={set.reps}
            unit={unit}
            weightLabel={`${name} weight (${unit})`}
            repsLabel={`${name} reps`}
            onWeight={(value) => void updateSetLog(set.id, { weight: toCanonical(value, unit) })}
            onReps={(value) => void updateSetLog(set.id, { reps: value })}
          />
          {drops.map((drop, index) => (
            <DropEditors
              key={`${set.id}:${index}`}
              drop={drop}
              index={index}
              unit={unit}
              set={set}
            />
          ))}
          <button
            type="button"
            className="ledger-remove"
            aria-label={set.isWarmup ? `Remove warm-up set ${set.setNumber}` : `Remove set ${set.setNumber}`}
            onClick={() => void deleteSetLog(set.id)}
          >
            −
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="ledger-token"
          aria-label={`${label}. Edit.`}
          onClick={() => {
            if (skipClick.current) {
              skipClick.current = false;
              return;
            }
            onEdit();
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <Figures weight={set.weight} reps={set.reps} unit={unit} />
          {drops.map((drop, index) => (
            <span key={`${set.id}:${index}`} className="ledger-drop">
              <span className="ledger-arrow" aria-hidden="true">
                →
              </span>
              <Figures weight={drop.weight} reps={drop.reps} unit={unit} />
            </span>
          ))}
        </button>
      )}
    </li>
  );
}

function DropEditors({
  drop,
  index,
  unit,
  set,
}: {
  drop: SetDrop;
  index: number;
  unit: Unit;
  set: SetLog;
}) {
  return (
    <span className="ledger-drop">
      <span className="ledger-arrow" aria-hidden="true">
        →
      </span>
      <PairEditors
        weight={drop.weight}
        reps={drop.reps}
        unit={unit}
        weightLabel={`Drop ${index + 1} weight (${unit})`}
        repsLabel={`Drop ${index + 1} reps`}
        onWeight={(value) =>
          void updateSetDrop(set.id, index, { weight: toCanonical(value, unit) })
        }
        onReps={(value) => void updateSetDrop(set.id, index, { reps: value })}
      />
      <button
        type="button"
        className="ledger-drop-remove"
        aria-label={`Remove drop ${index + 1} from set ${set.setNumber}`}
        onClick={() => void deleteSetDrop(set.id, index)}
      >
        −
      </button>
    </span>
  );
}
