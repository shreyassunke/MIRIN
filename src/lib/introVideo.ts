export const INTRO_SRC = "/mirin-intro.mp4";
export const INTRO_SESSION_KEY = "mirin:intro-complete";

let blobUrl: string | null = null;
let loadPromise: Promise<string> | null = null;

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function shouldShowIntro(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return false;
  }
  return sessionStorage.getItem(INTRO_SESSION_KEY) !== "1";
}

/** Begin fetching the intro before React mounts so playback can start sooner. */
export function prefetchIntroVideo(): void {
  if (!shouldShowIntro()) return;
  void getIntroVideoUrl().catch(() => undefined);
}

async function fetchIntroBlob(): Promise<string> {
  const response = await fetch(INTRO_SRC, {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error(`Intro video failed to load (${response.status})`);
  }

  const blob = await response.blob();
  if (!blob.size) {
    throw new Error("Intro video is empty");
  }

  return URL.createObjectURL(blob);
}

export function getIntroVideoUrl(): Promise<string> {
  if (blobUrl) return Promise.resolve(blobUrl);
  if (!loadPromise) {
    loadPromise = fetchIntroBlob()
      .then((url) => {
        blobUrl = url;
        return url;
      })
      .catch((error) => {
        loadPromise = null;
        throw error;
      });
  }
  return loadPromise;
}

export function releaseIntroVideoUrl(): void {
  if (blobUrl) {
    URL.revokeObjectURL(blobUrl);
    blobUrl = null;
  }
  loadPromise = null;
}

export function configureVideoForIOS(video: HTMLVideoElement): void {
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "true");
  video.setAttribute("x-webkit-airplay", "deny");
}
