import {
  createContext,
  useContext,
  useEffect,
  useMemo,
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
}

const RECOVERY_KEY = "mirin.auth.recovery";

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
  const native = isNativeApp();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: authRedirectUrl(),
      skipBrowserRedirect: native,
    },
  });
  if (error) return { error: error.message };
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

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (!data.session) {
        writeRecoveryFlag(false);
        setRecovery(false);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === "PASSWORD_RECOVERY") {
        writeRecoveryFlag(true);
        setRecovery(true);
      }
      setSession(next);
      setLoading(false);
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

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: isSupabaseConfigured,
      loading,
      session,
      user: session?.user ?? null,
      recovery,

      async signIn(email, password) {
        const supabase = getSupabase();
        if (!supabase) return { error: "Supabase is not configured." };
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
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
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: fullName ? { full_name: fullName } : undefined,
          },
        });
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
        const { error } = await supabase.auth.updateUser({ password });
        if (!error) {
          writeRecoveryFlag(false);
          setRecovery(false);
        }
        return { error: error?.message ?? null };
      },

      signInWithGoogle() {
        return startOAuth("google");
      },

      async signInWithApple() {
        if (isNativeApp()) {
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
            if (!token) return { error: "Apple did not return a token." };
            const supabase = getSupabase();
            if (!supabase) return { error: "Supabase is not configured." };
            const { error } = await supabase.auth.signInWithIdToken({
              provider: "apple",
              token,
            });
            if (error) return { error: error.message };
            const name = [result.response.givenName, result.response.familyName]
              .filter(Boolean)
              .join(" ");
            if (name) {
              await supabase.auth.updateUser({ data: { full_name: name } });
            }
            return { error: null };
          } catch (err) {
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
        setRecovery(false);
        const { error } = await supabase.auth.signOut();
        return { error: error?.message ?? null };
      },
    }),
    [loading, session, recovery],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
