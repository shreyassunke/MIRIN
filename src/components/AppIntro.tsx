import { useCallback, useEffect, useRef, useState } from "react";

const INTRO_SRC = "/mirin-intro.mp4";
const SESSION_KEY = "mirin:intro-complete";

type AppIntroProps = {
  onComplete: () => void;
};

export function AppIntro({ onComplete }: AppIntroProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [exiting, setExiting] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const completedRef = useRef(false);
  const playbackStartedRef = useRef(false);

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    sessionStorage.setItem(SESSION_KEY, "1");

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) {
      onComplete();
      return;
    }

    setExiting(true);
  }, [onComplete]);

  const startPlayback = useCallback(async () => {
    const video = videoRef.current;
    if (!video || completedRef.current) return false;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");

    try {
      await video.play();
      playbackStartedRef.current = true;
      setNeedsTap(false);
      return true;
    } catch {
      if (!playbackStartedRef.current) setNeedsTap(true);
      return false;
    }
  }, []);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) {
      onComplete();
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    const tryPlay = () => {
      window.setTimeout(() => {
        void startPlayback();
      }, 0);
    };

    video.addEventListener("canplay", tryPlay, { once: true });
    video.addEventListener("loadeddata", tryPlay, { once: true });
    video.load();

    return () => {
      video.removeEventListener("canplay", tryPlay);
      video.removeEventListener("loadeddata", tryPlay);
    };
  }, [onComplete, startPlayback]);

  const handleTransitionEnd = (event: React.TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || !exiting) return;
    onComplete();
  };

  return (
    <div
      className={[
        "fixed inset-0 z-50 bg-bg",
        "transition-opacity duration-500 motion-reduce:transition-none",
        exiting ? "pointer-events-none opacity-0" : "opacity-100",
      ].join(" ")}
      style={{ transitionTimingFunction: "var(--ease-out-quint)" }}
      onTransitionEnd={handleTransitionEnd}
      aria-hidden={exiting}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <video
          ref={videoRef}
          className="h-full w-full object-contain"
          width={1080}
          height={1920}
          autoPlay
          muted
          playsInline
          preload="auto"
          poster="/logo.png"
          onEnded={finish}
          onPlaying={() => {
            playbackStartedRef.current = true;
            setNeedsTap(false);
          }}
          aria-hidden
        >
          <source src={INTRO_SRC} type="video/mp4" />
        </video>
      </div>

      {needsTap ? (
        <button
          type="button"
          onClick={() => void startPlayback()}
          className="absolute inset-0 flex items-center justify-center bg-bg/60"
          aria-label="Play intro"
        >
          <span className="rounded-md bg-surface px-4 py-3 text-sm font-medium text-ink">
            Tap to play
          </span>
        </button>
      ) : null}

      <button
        type="button"
        onClick={finish}
        className="absolute z-10 min-h-11 rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors duration-150 hover:text-ink"
        style={{
          top: "max(1rem, env(safe-area-inset-top))",
          right: "max(1rem, env(safe-area-inset-right))",
        }}
        aria-label="Skip intro"
      >
        Skip
      </button>
    </div>
  );
}

export function shouldShowIntro(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return false;
  }
  return sessionStorage.getItem(SESSION_KEY) !== "1";
}
