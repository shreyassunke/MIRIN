import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { GoogleMark } from "../components/GoogleMark";

type Mode = "sign-in" | "sign-up";

const inputClass =
  "h-12 w-full rounded-md border border-hairline bg-bg px-3 text-base text-ink placeholder:text-muted transition-colors duration-150 focus:border-muted";
const primaryBtn =
  "btn-primary h-12 w-full rounded-pill bg-accent px-5 text-sm font-medium text-bg hover:bg-ink disabled:opacity-40";
const googleBtn =
  "glass-btn flex h-12 w-full items-center justify-center gap-2.5 rounded-pill px-5 text-sm font-medium text-ink disabled:opacity-40";
const ghostBtn =
  "text-sm font-medium text-muted transition-colors duration-150 hover:text-ink";

export function Auth() {
  const { configured, loading, session, signIn, signUp, signInWithGoogle } =
    useAuth();
  const location = useLocation();
  const from =
    (location.state as { from?: string } | null)?.from &&
    (location.state as { from: string }).from !== "/auth"
      ? (location.state as { from: string }).from
      : "/today";

  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg px-4">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  if (session) {
    return <Navigate to={from} replace />;
  }

  function resetMessages() {
    setError(null);
    setInfo(null);
  }

  async function onGoogle() {
    resetMessages();
    setSubmitting(true);
    try {
      const result = await signInWithGoogle();
      if (result.error) setError(result.error);
    } finally {
      setSubmitting(false);
    }
  }

  async function onEmailSubmit(e: FormEvent) {
    e.preventDefault();
    resetMessages();

    if (mode === "sign-up" && !name.trim()) {
      setError("Enter your name.");
      return;
    }
    if (!email.trim() || password.length < 6) {
      setError("Enter an email and a password of at least 6 characters.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "sign-in") {
        const result = await signIn(email, password);
        if (result.error) setError(result.error);
      } else {
        const result = await signUp(email, password, name);
        if (result.error) {
          setError(result.error);
        } else if (result.needsEmailConfirmation) {
          setInfo("Check your email to confirm the account, then sign in.");
          setMode("sign-in");
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <img
            src="/logo.png"
            alt=""
            className="h-8 w-auto rounded"
            width="32"
            height="32"
          />
          <span className="text-lg font-semibold tracking-tight">MIRIN</span>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">
          {mode === "sign-in" ? "Sign in" : "Create account"}
        </h1>
        <p className="mt-2 max-w-[65ch] text-[15px] leading-relaxed text-muted">
          {mode === "sign-in"
            ? "Sign in to open your training log."
            : "Create an account to keep your log across devices."}
        </p>

        {!configured ? (
          <div className="mt-8 rounded-xl glass p-4">
            <p className="text-[15px] leading-relaxed text-ink">
              Supabase is not configured.
            </p>
            <p className="mt-2 max-w-[65ch] text-[13px] leading-relaxed text-muted">
              Copy <span className="text-ink">.env.example</span> to{" "}
              <span className="text-ink">.env</span>, set{" "}
              <span className="text-ink">VITE_SUPABASE_URL</span> and{" "}
              <span className="text-ink">VITE_SUPABASE_ANON_KEY</span>, then
              restart the dev server.
            </p>
          </div>
        ) : (
          <div className="mt-8 flex flex-col gap-5">
            <button
              type="button"
              className={googleBtn}
              disabled={submitting}
              onClick={() => void onGoogle()}
            >
              <GoogleMark />
              Continue with Google
            </button>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-hairline" />
              <span className="text-[12px] text-muted">or</span>
              <div className="h-px flex-1 bg-hairline" />
            </div>

            <form className="flex flex-col gap-4" onSubmit={onEmailSubmit}>
              {mode === "sign-up" ? (
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium text-muted">
                    Name
                  </span>
                  <input
                    className={inputClass}
                    type="text"
                    name="name"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </label>
              ) : null}

              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-muted">Email</span>
                <input
                  className={inputClass}
                  type="email"
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-muted">
                  Password
                </span>
                <input
                  className={inputClass}
                  type="password"
                  name="password"
                  autoComplete={
                    mode === "sign-in" ? "current-password" : "new-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </label>

              <button
                type="submit"
                className={primaryBtn}
                disabled={submitting}
              >
                {submitting
                  ? "Working…"
                  : mode === "sign-in"
                    ? "Sign in"
                    : "Create account"}
              </button>
            </form>

            {error ? (
              <p className="text-[13px] leading-relaxed text-ink" role="alert">
                {error}
              </p>
            ) : null}
            {info ? (
              <p className="text-[13px] leading-relaxed text-muted" role="status">
                {info}
              </p>
            ) : null}
          </div>
        )}

        {configured ? (
          <p className="mt-6 text-[13px] text-muted">
            {mode === "sign-in" ? (
              <>
                No account yet?{" "}
                <button
                  type="button"
                  className={ghostBtn}
                  onClick={() => {
                    setMode("sign-up");
                    resetMessages();
                  }}
                >
                  Create one
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  className={ghostBtn}
                  onClick={() => {
                    setMode("sign-in");
                    resetMessages();
                  }}
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        ) : null}
      </div>
    </div>
  );
}
