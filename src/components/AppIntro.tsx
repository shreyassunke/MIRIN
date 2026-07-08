import { useCallback, useEffect, useRef, useState } from "react";

const INTRO_SRC = "/Mirin%20app%20intro.mp4";
const SESSION_KEY = "mirin:intro-complete";

type AppIntroProps = {
  onComplete: () => void;
};

export function AppIntro({ onComplete }: AppIntroProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [exiting, setExiting] = useState(false);
  const completedRef = useRef(false);

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
      void video.play().catch(() => {
        // Autoplay with sound is blocked on many mobile browsers; retry muted.
        video.muted = true;
        void video.play().catch(() => finish());
      });
    };

    if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      tryPlay();
    } else {
      video.addEventListener("loadeddata", tryPlay, { once: true });
      return () => video.removeEventListener("loadeddata", tryPlay);
    }
  }, [finish, onComplete]);

  const handleTransitionEnd = (event: React.TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || !exiting) return;
    onComplete();
  };

  return (
    <div
      className={[
        "fixed inset-0 z-50 flex items-center justify-center bg-bg",
        "transition-opacity duration-500 motion-reduce:transition-none",
        exiting ? "pointer-events-none opacity-0" : "opacity-100",
      ].join(" ")}
      style={{ transitionTimingFunction: "var(--ease-out-quint)" }}
      onTransitionEnd={handleTransitionEnd}
      aria-hidden={exiting}
    >
      <video
        ref={videoRef}
        src={INTRO_SRC}
        className="h-full w-full object-contain"
        playsInline
        preload="auto"
        onEnded={finish}
        onError={finish}
        aria-hidden
      />

      <button
        type="button"
        onClick={finish}
        className="absolute right-4 top-4 min-h-11 rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors duration-150 hover:text-ink"
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
