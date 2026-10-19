import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ConfirmDelete } from "./ConfirmDelete";
import { db, type Goal } from "../db/db";
import {
  deleteGoal,
  formatRecordDate,
  priorBestExcluding,
  sealMetGoals,
  stampCrossedGoals,
} from "../lib/goals";
import { useUnit } from "../lib/settings";
import { toDisplay } from "../lib/units";
import { formatWeight } from "../lib/workout";

export interface StrikeHit {
  exerciseId: string;
  weightLb: number;
  priorBestLb: number;
}

interface Ceremony {
  goalId: string;
  name: string;
  equipment?: string;
  weightLb: number;
  achievedAt: string;
  mode: "live" | "replay";
}

interface GoalCeremonyApi {
  strikeMany: (hits: StrikeHit[]) => Promise<void>;
  noteEditedWeight: (exerciseId: string, logId: string, weightLb: number) => Promise<void>;
  replay: (entry: Omit<Ceremony, "mode">) => void;
}

const GoalCeremonyContext = createContext<GoalCeremonyApi | null>(null);

export function useGoalCeremony(): GoalCeremonyApi {
  const api = useContext(GoalCeremonyContext);
  if (!api) throw new Error("Goal ceremony is only available inside the app shell");
  return api;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function GoalCeremonyProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Ceremony[]>([]);
  const queueRef = useRef(queue);
  queueRef.current = queue;

  useEffect(() => {
    void sealMetGoals();
  }, []);

  const strikeMany = useCallback(async (hits: StrikeHit[]) => {
    const stamped: Goal[] = [];
    for (const hit of hits) {
      const goals = await stampCrossedGoals(
        hit.exerciseId,
        hit.weightLb,
        hit.priorBestLb,
      );
      stamped.push(...goals);
    }
    if (stamped.length === 0) return;
    const ids = [...new Set(stamped.map((goal) => goal.exerciseId))];
    const rows = await db.exercises.bulkGet(ids);
    const byId = new Map(ids.map((id, index) => [id, rows[index]] as const));
    setQueue((current) => [
      ...current,
      ...stamped.map((goal) => {
        const exercise = byId.get(goal.exerciseId);
        return {
          goalId: goal.id,
          name: exercise?.name ?? "Exercise",
          equipment: exercise?.equipment,
          weightLb: goal.achievedWeight ?? goal.targetWeight,
          achievedAt: goal.achievedAt ?? new Date().toISOString(),
          mode: "live" as const,
        };
      }),
    ]);
  }, []);

  const noteEditedWeight = useCallback(
    async (exerciseId: string, logId: string, weightLb: number) => {
      const priorBestLb = await priorBestExcluding(exerciseId, logId);
      await strikeMany([{ exerciseId, weightLb, priorBestLb }]);
    },
    [strikeMany],
  );

  const replay = useCallback((entry: Omit<Ceremony, "mode">) => {
    if (queueRef.current.some((item) => item.mode === "live")) return;
    setQueue([{ ...entry, mode: "replay" }]);
  }, []);

  const pop = useCallback(() => {
    setQueue((current) => current.slice(1));
  }, []);

  const remove = useCallback(async (goalId: string) => {
    await deleteGoal(goalId);
    setQueue((current) => current.filter((item) => item.goalId !== goalId));
  }, []);

  const api = useRef<GoalCeremonyApi>({ strikeMany, noteEditedWeight, replay });
  api.current = { strikeMany, noteEditedWeight, replay };

  const stable = useRef<GoalCeremonyApi | null>(null);
  if (!stable.current) {
    stable.current = {
      strikeMany: (hits) => api.current.strikeMany(hits),
      noteEditedWeight: (exerciseId, logId, weightLb) =>
        api.current.noteEditedWeight(exerciseId, logId, weightLb),
      replay: (entry) => api.current.replay(entry),
    };
  }

  return (
    <GoalCeremonyContext.Provider value={stable.current}>
      {children}
      <GoalCeremonyOverlay
        entry={queue[0] ?? null}
        onDone={pop}
        onRemove={(goalId) => void remove(goalId)}
      />
    </GoalCeremonyContext.Provider>
  );
}

function GoalCeremonyOverlay({
  entry,
  onDone,
  onRemove,
}: {
  entry: Ceremony | null;
  onDone: () => void;
  onRemove: (goalId: string) => void;
}) {
  const [unit] = useUnit();
  const [phase, setPhase] = useState<"in" | "out">("in");
  const dialogRef = useRef<HTMLDivElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    setPhase("in");
  }, [entry?.goalId, entry?.mode]);

  useEffect(() => {
    if (!entry) return;
    const previous = document.activeElement as HTMLElement | null;
    continueRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [entry]);

  const finish = () => {
    if (phaseRef.current === "out") return;
    if (prefersReducedMotion()) {
      onDone();
      return;
    }
    setPhase("out");
  };

  if (!entry) return null;

  const weight = formatWeight(toDisplay(entry.weightLb, unit));
  const date = formatRecordDate(entry.achievedAt);
  const live = entry.mode === "live";

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-title"
      data-phase={phase}
      className="record-veil fixed inset-0 z-[60] flex flex-col bg-bg px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      onAnimationEnd={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.animationName !== "record-veil-out") return;
        onDone();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          finish();
          return;
        }
        if (event.key !== "Tab") return;
        const root = dialogRef.current;
        if (!root) return;
        const items = [...root.querySelectorAll<HTMLElement>("button")];
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
    >
      <div className="flex flex-1 flex-col items-center justify-center">
        <div key={entry.goalId} className="record-medal flex flex-col items-center text-ink">
          <div className="record-logo" role="img" aria-label="Mirin" />
          <p className="tnum mt-6 text-2xl font-semibold leading-none tracking-tight">
            {weight}
            <span className="ml-1 text-[13px] font-medium text-muted">{unit}</span>
          </p>
        </div>
        <h2
          id="record-title"
          className="mt-8 max-w-[18rem] text-balance text-center text-xl font-semibold tracking-tight"
        >
          {entry.name}
        </h2>
        <p className="mt-1 text-[13px] font-medium text-muted">{date}</p>
        <blockquote className="record-line">
          <p>WE'RE ALL GONNA MAKE IT BRAH</p>
          <footer>— Zyzz</footer>
        </blockquote>
      </div>
      <div className="mx-auto flex w-full max-w-xs flex-col items-center gap-4">
        <button
          ref={continueRef}
          type="button"
          className="btn-primary h-11 w-full rounded-pill text-sm font-medium"
          onClick={finish}
        >
          {live ? "Continue" : "Close"}
        </button>
        {live ? null : (
          <ConfirmDelete onConfirm={() => onRemove(entry.goalId)} label="Remove" />
        )}
      </div>
    </div>
  );
}
