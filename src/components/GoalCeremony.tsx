import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
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

const RECORD_FILM = "/Mirin%20app%20intro.mp4";

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function ceremonyKey(entry: Ceremony | null): string {
  return entry ? `${entry.mode}:${entry.goalId}` : "";
}

/** Start the film inside the click that opened it, so the browser allows sound. */
function primeRecordFilm(video: HTMLVideoElement | null) {
  if (!video || prefersReducedMotion()) return;
  video.muted = false;
  try {
    video.currentTime = 0;
  } catch {
    /* The file may still be opening. */
  }
  const attempt = video.play();
  if (!attempt) return;
  void attempt.catch(() => {
    video.muted = true;
    void video.play().catch(() => {});
  });
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

  const filmRef = useRef<HTMLVideoElement>(null);

  const replay = useCallback((entry: Omit<Ceremony, "mode">) => {
    if (queueRef.current.some((item) => item.mode === "live")) return;
    primeRecordFilm(filmRef.current);
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
        filmRef={filmRef}
        onDone={pop}
        onRemove={(goalId) => void remove(goalId)}
      />
    </GoalCeremonyContext.Provider>
  );
}

function GoalCeremonyOverlay({
  entry,
  filmRef,
  onDone,
  onRemove,
}: {
  entry: Ceremony | null;
  filmRef: RefObject<HTMLVideoElement>;
  onDone: () => void;
  onRemove: (goalId: string) => void;
}) {
  const [unit] = useUnit();
  const key = ceremonyKey(entry);
  const [trackedKey, setTrackedKey] = useState(key);
  const [phase, setPhase] = useState<"in" | "out">("in");
  const [fromFilm, setFromFilm] = useState(
    () => key !== "" && !prefersReducedMotion(),
  );
  const [showFilm, setShowFilm] = useState(
    () => key !== "" && !prefersReducedMotion(),
  );
  const [filmLeaving, setFilmLeaving] = useState(false);
  const [revealed, setRevealed] = useState(
    () => key === "" || prefersReducedMotion(),
  );
  const dialogRef = useRef<HTMLDivElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const phaseRef = useRef(phase);
  const revealedRef = useRef(revealed);
  phaseRef.current = phase;

  if (key !== trackedKey) {
    const reduced = prefersReducedMotion();
    const open = key !== "";
    setTrackedKey(key);
    setPhase("in");
    setFromFilm(open && !reduced);
    setShowFilm(open && !reduced);
    setFilmLeaving(false);
    setRevealed(!open || reduced);
    revealedRef.current = !open || reduced;
  } else {
    revealedRef.current = revealed;
  }

  useEffect(() => {
    if (!entry) return;
    const previous = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [entry]);

  useEffect(() => {
    if (!entry) return;
    if (revealed) continueRef.current?.focus();
    else skipRef.current?.focus();
  }, [entry, revealed]);

  const dissolve = () => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    filmRef.current?.pause();
    setFilmLeaving(true);
    setRevealed(true);
  };

  useEffect(() => {
    if (entry) return;
    const video = filmRef.current;
    if (!video) return;
    video.pause();
    try {
      video.currentTime = 0;
    } catch {
      /* Unloaded. */
    }
  }, [entry, filmRef]);

  useEffect(() => {
    if (!entry || !showFilm || revealed) return;
    const video = filmRef.current;
    if (!video || (!video.paused && !video.ended)) return;
    let cancelled = false;
    video.muted = false;
    const start = async () => {
      try {
        await video.play();
        if (cancelled) video.pause();
      } catch {
        if (cancelled) return;
        video.muted = true;
        try {
          await video.play();
          if (cancelled) video.pause();
        } catch {
          if (!cancelled) dissolve();
        }
      }
    };
    void start();
    return () => {
      cancelled = true;
      video.pause();
    };
  }, [entry, showFilm, revealed, filmRef]);

  const finish = () => {
    if (!revealedRef.current) {
      dissolve();
      return;
    }
    if (phaseRef.current === "out") return;
    if (prefersReducedMotion()) {
      onDone();
      return;
    }
    setPhase("out");
  };

  const weight = entry ? formatWeight(toDisplay(entry.weightLb, unit)) : "";
  const date = entry ? formatRecordDate(entry.achievedAt) : "";
  const live = entry?.mode === "live";
  const filmOn = Boolean(entry) && showFilm;
  const filmClass = filmLeaving ? "record-film-out" : "";

  return (
    <div
      ref={dialogRef}
      role={entry ? "dialog" : undefined}
      aria-modal={entry ? true : undefined}
      aria-labelledby={entry && revealed ? "record-title" : undefined}
      aria-label={entry && !revealed ? "Record intro" : undefined}
      data-phase={phase}
      data-revealed={revealed ? "true" : "false"}
      className={
        entry
          ? [
              "record-veil fixed inset-0 z-[60] flex flex-col bg-bg px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]",
              fromFilm ? "record-veil-from-film" : "",
            ]
              .filter(Boolean)
              .join(" ")
          : "record-film-host"
      }
      onAnimationEnd={(event) => {
        if (!entry) return;
        if (event.target !== event.currentTarget) return;
        if (event.animationName !== "record-veil-out") return;
        onDone();
      }}
      onKeyDown={(event) => {
        if (!entry) return;
        if (event.key === "Escape") {
          event.preventDefault();
          finish();
          return;
        }
        if (event.key !== "Tab") return;
        const root = dialogRef.current;
        if (!root) return;
        const items = [...root.querySelectorAll<HTMLElement>("button")].filter(
          (button) => !button.hasAttribute("disabled") && button.getClientRects().length > 0,
        );
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
      {filmOn ? (
        <div
          className={["record-film", filmClass].filter(Boolean).join(" ")}
          onAnimationEnd={(event) => {
            if (event.target !== event.currentTarget) return;
            if (event.animationName !== "record-film-out") return;
            event.stopPropagation();
            setShowFilm(false);
          }}
        />
      ) : null}
      <video
        ref={filmRef}
        className={
          filmOn
            ? ["record-film-video", filmClass].filter(Boolean).join(" ")
            : "record-film-parked"
        }
        src={RECORD_FILM}
        playsInline
        preload="auto"
        onEnded={() => {
          if (filmOn) dissolve();
        }}
        onError={() => {
          if (filmOn) dissolve();
        }}
      />
      {filmOn ? (
        <button
          ref={skipRef}
          type="button"
          className={["record-film-skip", filmClass].filter(Boolean).join(" ")}
          onClick={dissolve}
          disabled={filmLeaving}
        >
          Skip
        </button>
      ) : null}
      {entry ? (
      <>
      <div
        className="record-body flex flex-1 flex-col items-center justify-center"
        aria-hidden={revealed ? undefined : true}
      >
        <div className="record-mark">
        <div key={entry.goalId} className="record-medal flex flex-col items-center text-ink">
          <div className="record-logo record-logo-live" role="img" aria-label="Mirin">
            <span className="record-logo-flow" aria-hidden="true" />
          </div>
          <p className="tnum mt-6 text-2xl font-semibold leading-none tracking-tight">
            {weight}
            <span className="ml-1 text-[13px] font-medium text-muted">{unit}</span>
          </p>
        </div>
        </div>
        <div className="record-copy">
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
      </div>
      <div
        className="record-actions mx-auto flex w-full max-w-xs flex-col items-center gap-4"
        aria-hidden={revealed ? undefined : true}
      >
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
      </>
      ) : null}
    </div>
  );
}
