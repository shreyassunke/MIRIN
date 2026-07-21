import { useEffect, useState, type ReactNode } from "react";

const SPLASH_KEY = "mirin-boot-splash";
const HOLD_MS = 900;
const EXIT_MS = 380;

type Phase = "show" | "exit" | "done";

/**
 * Brief logo hold on cold open of the authenticated app, then reveal the
 * shell. Once per browser session; skipped under reduced motion.
 */
export function BootSplash({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>(() => {
    if (typeof sessionStorage === "undefined") return "show";
    return sessionStorage.getItem(SPLASH_KEY) ? "done" : "show";
  });

  useEffect(() => {
    if (sessionStorage.getItem(SPLASH_KEY)) {
      setPhase("done");
      return;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    if (reduced) {
      sessionStorage.setItem(SPLASH_KEY, "1");
      setPhase("done");
      return;
    }

    const exitTimer = window.setTimeout(() => setPhase("exit"), HOLD_MS);
    const doneTimer = window.setTimeout(() => {
      sessionStorage.setItem(SPLASH_KEY, "1");
      setPhase("done");
    }, HOLD_MS + EXIT_MS);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(doneTimer);
    };
  }, []);

  return (
    <>
      {children}
      {phase !== "done" ? (
        <div
          className={[
            "fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-bg",
            phase === "exit" ? "mirin-splash-exit" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-hidden="true"
        >
          <div className="mirin-splash-mark flex flex-col items-center gap-4">
            <img
              src="/logo.png"
              alt=""
              className="h-16 w-auto rounded-md"
              width="64"
              height="64"
            />
            <span className="text-xl font-semibold tracking-tight text-ink">
              MIRIN
            </span>
          </div>
        </div>
      ) : null}
    </>
  );
}
