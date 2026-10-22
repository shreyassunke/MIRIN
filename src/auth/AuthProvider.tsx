import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { deleteRemoteAccount, wipeLocalLog } from "../lib/account";
import { authRedirectUrl, isNativeApp } from "../lib/native";
import { getSupabase, isSupabaseConfigured } from "../lib/supabase";

interface AuthContextValue {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  /** True while a password-reset link has opened a session and the new password is not saved yet. */
  recovery: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    name: string,
  ) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signInWithApple: () => Promise<{ error: string | null }>;
  deleteAccount: () => Promise<{ error: string | null }>;
  updateDisplayName: (name: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<{ error: string | null }>;
  /** True while the sign-in screen should stay mounted and fade out. */
  handoff: boolean;
}

const RECOVERY_KEY = "mirin.auth.recovery";
const HANDOFF_KEY = "mirin.auth.handoff";
/** Same key as BootSplash. Set before Today mounts so the logo does not play twice. */
const BOOT_SPLASH_KEY = "mirin-boot-splash";

/** Matches --motion-nav, --motion-snap, and the passage rules in index.css. */
const PASSAGE_FADE_MS = 180;
const PASSAGE_MARK_MS = 180;
const PASSAGE_REST_MS = 80;
const PASSAGE_EXIT_MS = 140;

type Passage = "off" | "fade" | "hold" | "out";

function readHandoff(): boolean {
  try {
    return sessionStorage.getItem(HANDOFF_KEY) === "1";
  } catch {
    return false;
  }
}

export function authHandoffPending(): boolean {
  return readHandoff();
}

function armHandoff() {
  try {
    sessionStorage.setItem(HANDOFF_KEY, "1");
  } catch {
    /* Private mode can block storage; the in-memory passage still covers this visit. */
  }
}

function disarmHandoff() {
  try {
    sessionStorage.removeItem(HANDOFF_KEY);
  } catch {
    /* ignore */
  }
}

function markBootSeen() {
  try {
    sessionStorage.setItem(BOOT_SPLASH_KEY, "1");
  } catch {
    /* ignore */
  }
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function oauthCallbackPending() {
  const search = new URLSearchParams(window.location.search);
  if (search.has("code")) return true;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return (
    hash.has("access_token") ||
    hash.has("error") ||
    hash.has("error_description")
  );
}

function readRecoveryFlag(): boolean {
  try {
    return sessionStorage.getItem(RECOVERY_KEY) === "1";
  } catch {
    return false;
  }
}

function writeRecoveryFlag(on: boolean) {
  try {
    if (on) sessionStorage.setItem(RECOVERY_KEY, "1");
    else sessionStorage.removeItem(RECOVERY_KEY);
  } catch {
    /* Private mode can block storage; the in-memory flag still covers this visit. */
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

const CALLBACK = "mirin://auth/callback";

async function completeOAuthReturn(url: string): Promise<void> {
  if (!url.startsWith(CALLBACK)) return;
  const supabase = getSupabase();
  if (!supabase) return;
  const parsed = new URL(url);
  const description =
    parsed.searchParams.get("error_description") ??
    parsed.searchParams.get("error");
  if (description) return;
  const code = parsed.searchParams.get("code");
  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  } else {
    const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
    const access = hash.get("access_token");
    const refresh = hash.get("refresh_token");
    if (access && refresh) {
      await supabase.auth.setSession({
        access_token: access,
        refresh_token: refresh,
      });
    }
  }
  const { Browser } = await import("@capacitor/browser");
  await Browser.close().catch(() => undefined);
}

async function startOAuth(
  provider: "google" | "apple",
): Promise<{ error: string | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: "Supabase is not configured." };
  armHandoff();
  const native = isNativeApp();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: authRedirectUrl(),
      skipBrowserRedirect: native,
    },
  });
  if (error) {
    disarmHandoff();
    return { error: error.message };
  }
  if (native && data.url) {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url: data.url });
  }
  return { error: null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [recovery, setRecovery] = useState(readRecoveryFlag);
  const [passage, setPassage] = useState<Passage>("off");
  const [release, setRelease] = useState(0);
  const armedOnLoad = useRef(readHandoff());
  const playing = useRef(false);
  const phase = useRef<Passage>("off");
  const entry = useRef<"return" | "inplace" | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const noteSession = (next: Session | null) => {
      if (next && readHandoff() && !readRecoveryFlag()) markBootSeen();
      setSession(next);
      setLoading(false);
    };

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (!data.session) {
        writeRecoveryFlag(false);
        setRecovery(false);
      }
      noteSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === "PASSWORD_RECOVERY") {
        writeRecoveryFlag(true);
        setRecovery(true);
      }
      noteSession(next);
    });

    let removeUrl: (() => void) | undefined;
    if (isNativeApp()) {
      void import("@capacitor/app").then(({ App }) => {
        void App.addListener("appUrlOpen", ({ url }) => {
          void completeOAuthReturn(url);
        }).then((handle) => {
          removeUrl = () => {
            void handle.remove();
          };
        });
      });
    }

    return () => {
      mounted = false;
      subscription.unsubscribe();
      removeUrl?.();
    };
  }, []);

  const signedIn = Boolean(session);
  const reduced = prefersReducedMotion();
  const handoff =
    !reduced &&
    !loading &&
    signedIn &&
    !recovery &&
    (passage === "fade" || (passage === "off" && readHandoff()));

  useEffect(() => {
    if (playing.current || !readHandoff()) return;

    if (loading || !signedIn || recovery) {
      if (
        !recovery &&
        armedOnLoad.current &&
        oauthCallbackPending() &&
        !reduced &&
        phase.current === "off"
      ) {
        phase.current = "hold";
        entry.current = "return";
        setPassage("hold");
      }
      return;
    }

    if (!entry.current) {
      entry.current =
        armedOnLoad.current && phase.current === "hold" ? "return" : "inplace";
    }
    const returning = entry.current === "return";
    playing.current = true;
    markBootSeen();

    if (reduced) {
      disarmHandoff();
      playing.current = false;
      entry.current = null;
      armedOnLoad.current = false;
      setRelease((n) => n + 1);
      return;
    }

    const fadeMs = returning ? 0 : PASSAGE_FADE_MS;
    if (!returning) {
      phase.current = "fade";
      setPassage("fade");
    }

    let finished = false;
    const holdTimer = window.setTimeout(() => {
      phase.current = "hold";
      setPassage("hold");
    }, fadeMs);
    const outAt = returning
      ? 220
      : fadeMs + PASSAGE_MARK_MS + PASSAGE_REST_MS;
    const outTimer = window.setTimeout(() => {
      phase.current = "out";
      setPassage("out");
    }, outAt);
    const doneTimer = window.setTimeout(() => {
      finished = true;
      playing.current = false;
      entry.current = null;
      armedOnLoad.current = false;
      phase.current = "off";
      disarmHandoff();
      setPassage("off");
    }, outAt + PASSAGE_EXIT_MS);

    return () => {
      window.clearTimeout(holdTimer);
      window.clearTimeout(outTimer);
      window.clearTimeout(doneTimer);
      playing.current = false;
      if (finished || !readHandoff()) {
        entry.current = null;
        phase.current = "off";
        setPassage("off");
        return;
      }
      // Strict mode replays the effect immediately. Keep the same entry so
      // the second setup continues this passage instead of starting another.
      phase.current = returning ? "hold" : "fade";
      setPassage(phase.current);
    };
  }, [loading, signedIn, recovery, release, reduced]);

  useEffect(() => {
    if (loading || signedIn || !readHandoff()) return;
    if (oauthCallbackPending()) {
      const id = window.setTimeout(() => {
        disarmHandoff();
        armedOnLoad.current = false;
        phase.current = "off";
        setPassage("off");
        setRelease((n) => n + 1);
      }, 8000);
      return () => window.clearTimeout(id);
    }
    disarmHandoff();
    armedOnLoad.current = false;
    phase.current = "off";
    setPassage("off");
    if (!readHandoff()) setRelease((n) => n + 1);
  }, [loading, signedIn, release]);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: isSupabaseConfigured,
      loading,
      session,
      user: session?.user ?? null,
      recovery,
      handoff,

      async signIn(email, password) {
        const supabase = getSupabase();
        if (!supabase) return { error: "Supabase is not configured." };
        armHandoff();
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) disarmHandoff();
        return { error: error?.message ?? null };
      },

      async signUp(email, password, name) {
        const supabase = getSupabase();
        if (!supabase) {
          return {
            error: "Supabase is not configured.",
            needsEmailConfirmation: false,
          };
        }
        const fullName = name.trim();
        armHandoff();
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: fullName ? { full_name: fullName } : undefined,
          },
        });
        if (error || !data.session) disarmHandoff();
        if (error) {
          return { error: error.message, needsEmailConfirmation: false };
        }
        return { error: null, needsEmailConfirmation: !data.session };
      },

      async resetPassword(email) {
        const supabase = getSupabase();
        if (!supabase) return { error: "Supabase is not configured." };
        const trimmed = email.trim();
        if (!trimmed) return { error: "Enter your email, then try again." };
        const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
          redirectTo: authRedirectUrl(),
        });
        return { error: error?.message ?? null };
      },

      async updatePassword(password) {
        const supabase = getSupabase();
        if (!supabase) return { error: "Supabase is not configured." };
        if (password.length < 6) {
          return { error: "Use at least 6 characters." };
        }
        armHandoff();
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
          disarmHandoff();
          return { error: error.message };
        }
        markBootSeen();
        writeRecoveryFlag(false);
        setRecovery(false);
        return { error: null };
      },

      signInWithGoogle() {
        return startOAuth("google");
      },

      async signInWithApple() {
        if (isNativeApp()) {
          armHandoff();
          try {
            const { SignInWithApple } = await import(
              "@capacitor-community/apple-sign-in"
            );
            const result = await SignInWithApple.authorize({
              clientId: "app.mirin.ios",
              redirectURI: CALLBACK,
              scopes: "email name",
            });
            const token = result.response.identityToken;
            if (!token) {
              disarmHandoff();
              return { error: "Apple did not return a token." };
            }
            const supabase = getSupabase();
            if (!supabase) {
              disarmHandoff();
              return { error: "Supabase is not configured." };
            }
            const { error } = await supabase.auth.signInWithIdToken({
              provider: "apple",
              token,
            });
            if (error) {
              disarmHandoff();
              return { error: error.message };
            }
            const name = [result.response.givenName, result.response.familyName]
              .filter(Boolean)
              .join(" ");
            if (name) {
              await supabase.auth.updateUser({ data: { full_name: name } });
            }
            return { error: null };
          } catch (err) {
            disarmHandoff();
            const message =
              err instanceof Error ? err.message : "Apple sign-in was cancelled.";
            if (/cancel|1001|1000/i.test(message)) return { error: null };
            return { error: message };
          }
        }
        return startOAuth("apple");
      },

      async deleteAccount() {
        const remote = await deleteRemoteAccount();
        if (remote.error) return remote;
        await wipeLocalLog();
        const supabase = getSupabase();
        if (supabase) await supabase.auth.signOut();
        return { error: null };
      },

      async updateDisplayName(name) {
        const supabase = getSupabase();
        if (!supabase) return { error: "Supabase is not configured." };
        const fullName = name.trim();
        if (!fullName) return { error: "Enter a name." };
        const { error } = await supabase.auth.updateUser({
          data: { full_name: fullName },
        });
        return { error: error?.message ?? null };
      },

      async signOut() {
        const supabase = getSupabase();
        if (!supabase) return { error: "Supabase is not configured." };
        writeRecoveryFlag(false);
        disarmHandoff();
        setRecovery(false);
        const { error } = await supabase.auth.signOut();
        return { error: error?.message ?? null };
      },
    }),
    [loading, session, recovery, handoff],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {passage !== "off" ? <AuthPassage phase={passage} /> : null}
    </AuthContext.Provider>
  );
}

function AuthPassage({ phase }: { phase: Exclude<Passage, "off"> }) {
  return (
    <div className="auth-passage" data-phase={phase} role="status" aria-live="polite">
      <span className="sr-only">Loading</span>
      <img
        src="/mark.png"
        alt=""
        width={485}
        height={928}
        className="auth-passage-mark"
      />
    </div>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
