import { Capacitor } from "@capacitor/core";

/** True inside the Capacitor iOS (or Android) shell, false in a browser. */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/** OAuth must return to the app, not to a browser tab that cannot see the shell. */
export function authRedirectUrl(): string {
  if (isNativeApp()) return "mirin://auth/callback";
  return `${window.location.origin}/auth`;
}

/** Third-party pages open in the system browser. In-app routes stay in the webview. */
export async function openExternal(url: string): Promise<void> {
  if (isNativeApp()) {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url });
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function bootNativeShell(): Promise<void> {
  if (!isNativeApp()) return;
  const { StatusBar, Style } = await import("@capacitor/status-bar");
  const { SplashScreen } = await import("@capacitor/splash-screen");
  await StatusBar.setOverlaysWebView({ overlay: true });
  const light = document.documentElement.dataset.mode === "light";
  await StatusBar.setStyle({ style: light ? Style.Light : Style.Dark });
  await StatusBar.setBackgroundColor({
    color: light ? "#f3f2ef" : "#0a0a0a",
  });
  await SplashScreen.hide();
}

/** Light tap when a set is saved. Tabs do not call this. */
export async function confirmSetHaptic(): Promise<void> {
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    /* Web and devices without a taptic engine stay silent. */
  }
}
