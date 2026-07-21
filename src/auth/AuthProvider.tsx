import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "../lib/supabase";

interface AuthContextValue {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    name: string,
  ) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  updateDisplayName: (name: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);

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
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: isSupabaseConfigured,
      loading,
      session,
      user: session?.user ?? null,

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

      async signInWithGoogle() {
        const supabase = getSupabase();
        if (!supabase) return { error: "Supabase is not configured." };
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/auth`,
          },
        });
        return { error: error?.message ?? null };
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
        const { error } = await supabase.auth.signOut();
        return { error: error?.message ?? null };
      },
    }),
    [loading, session],
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
