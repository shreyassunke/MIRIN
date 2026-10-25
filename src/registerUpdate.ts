import type { RegisterSWOptions } from "virtual:pwa-register";
import { isNativeApp } from "./lib/native";

/**
 * iOS home-screen apps do not look for a new worker on their own.
 * Ask on open, and again whenever the app comes back to the front.
 * The worker reloads the open window once it takes control.
 */
export function registerAppUpdate() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  if (isNativeApp()) return;

  const url = new URL(window.location.href);
  if (url.searchParams.has("sw")) {
    url.searchParams.delete("sw");
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, "", next);
  }

  void import("virtual:pwa-register").then(({ registerSW }) => {
    const options: RegisterSWOptions = {
      immediate: true,
      onNeedReload() {
        /* public/sw-reload.js reloads the window from the worker. */
      },
      onRegisteredSW(swUrl, registration) {
        if (!registration) return;

        const check = async () => {
          if (registration.installing || !navigator.onLine) return;
          try {
            const response = await fetch(swUrl, {
              cache: "no-store",
              headers: { cache: "no-cache", pragma: "no-cache" },
            });
            if (response.ok) await registration.update();
          } catch {
            /* Offline. The installed shell stays until the next check. */
          }
        };

        void check();
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") void check();
        });
      },
    };
    registerSW(options);
  });
}
