import { useCallback, useEffect, useRef, useState } from "react";
import {
  INTRO_SESSION_KEY,
  configureVideoForIOS,
  getIntroVideoUrl,
  isIOS,
  releaseIntroVideoUrl,
} from "../lib/introVideo";

type Phase = "loading" | "ready" | "playing" | "error";

type AppIntroProps = {
  onComplete: () => void;
};

const MAX_PLAY_RETRIES = 3;

export function AppIntro({ onComplete }: AppIntroProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const completedRef = useRef(false);
  const playRetriesRef = useRef(0);
  const readyRef = useRef(false);
  const requiresTapRef = useRef(isIOS());
  const sourceSetRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("loading");
  const [exiting, setExiting] = useState(false);

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    sessionStorage.setItem(INTRO_SESSION_KEY, "1");
    releaseIntroVideoUrl();

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) {
      onComplete();
      return;
    }

    setExiting(true);
  }, [onComplete]);

  const markReady = useCallback(() => {
    if (readyRef.current || completedRef.current) return;
    readyRef.current = true;
    setPhase("ready");
  }, []);

  const attemptPlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video || completedRef.current || video.ended) return false;

    configureVideoForIOS(video);

    try {
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        await new Promise<void>((resolve, reject) => {
          const onReady = () => {
            cleanup();
            resolve();
          };
          const onError = () => {
            cleanup();
            reject(new Error("Video failed to buffer"));
          };
          const cleanup = () => {
            video.removeEventListener("canplay", onReady);
            video.removeEventListener("error", onError);
          };
          video.addEventListener("canplay", onReady, { once: true });
          video.addEventListener("error", onError, { once: true });
        });
      }

      await video.play();
      playRetriesRef.current = 0;
      setPhase("playing");
      return true;
    } catch {
      playRetriesRef.current += 1;
      if (playRetriesRef.current >= MAX_PLAY_RETRIES) {
        setPhase("error");
      } else {
        setPhase("ready");
      }
      return false;
    }
  }, []);

  const handleStart = useCallback(() => {
    void attemptPlay();
  }, [attemptPlay]);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) {
      onComplete();
      return;
    }

    let cancelled = false;
    const video = videoRef.current;
    if (!video) return;

    configureVideoForIOS(video);

    const onCanPlayThrough = () => {
      if (cancelled || completedRef.current) return;
      markReady();
      if (!requiresTapRef.current) {
        window.requestAnimationFrame(() => {
          void attemptPlay();
        });
      }
    };

    const onPlaying = () => {
      if (cancelled || completedRef.current) return;
      setPhase("playing");
    };

    const onWaiting = () => {
      const current = videoRef.current;
      if (!current || current.paused || current.ended || completedRef.current) {
        return;
      }
      void current.play().catch(() => undefined);
    };

    const onVisibilityChange = () => {
      const current = videoRef.current;
      if (
        document.hidden ||
        !current ||
        current.paused ||
        current.ended ||
        completedRef.current
      ) {
        return;
      }
      void current.play().catch(() => undefined);
    };

    video.addEventListener("canplaythrough", onCanPlayThrough);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("waiting", onWaiting);
    document.addEventListener("visibilitychange", onVisibilityChange);

    void getIntroVideoUrl()
      .then((url) => {
        if (cancelled || completedRef.current || sourceSetRef.current) return;
        sourceSetRef.current = true;
        video.src = url;
        video.load();
      })
      .catch(() => {
        if (!cancelled) setPhase("error");
      });

    return () => {
      cancelled = true;
      video.removeEventListener("canplaythrough", onCanPlayThrough);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("waiting", onWaiting);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [attemptPlay, markReady, onComplete]);

  const handleTransitionEnd = (event: React.TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || !exiting) return;
    onComplete();
  };

  const showStartOverlay = phase === "ready" || phase === "error";

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
      <div className="absolute inset-0 flex items-center justify-center [transform:translateZ(0)]">
        <video
          ref={videoRef}
          className="h-full w-full object-contain [transform:translateZ(0)]"
          width={1080}
          height={1920}
          muted
          playsInline
          preload="auto"
          poster="/logo.png"
          onEnded={finish}
          aria-hidden
        />
      </div>

      {phase === "loading" ? (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden
        >
          <img
            src="/logo.png"
            alt=""
            className="h-16 w-auto rounded opacity-80"
            width={64}
            height={64}
          />
        </div>
      ) : null}

      {showStartOverlay ? (
        <button
          type="button"
          onClick={handleStart}
          className="absolute inset-0 flex items-center justify-center bg-bg/40"
          aria-label={phase === "error" ? "Retry intro" : "Play intro"}
        >
          <span className="rounded-md bg-surface px-4 py-3 text-sm font-medium text-ink">
            {phase === "error" ? "Tap to retry" : "Tap to start"}
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

export { shouldShowIntro, prefetchIntroVideo } from "../lib/introVideo";
