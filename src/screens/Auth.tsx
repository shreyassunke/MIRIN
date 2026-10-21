import {
  useState,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { GoogleMark } from "../components/GoogleMark";

type Mode = "sign-in" | "sign-up";

const REMEMBER_KEY = "mirin.auth.email";

const primaryBtn = "auth-glass auth-glass-primary";
const providerBtn = "auth-glass";

function readRememberedEmail(): string {
  try {
    return localStorage.getItem(REMEMBER_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeRememberedEmail(email: string | null) {
  try {
    if (email) localStorage.setItem(REMEMBER_KEY, email);
    else localStorage.removeItem(REMEMBER_KEY);
  } catch {
    /* Private mode can block storage. The checkbox still applies to this visit. */
  }
}

export function Auth() {
  const {
    configured,
    loading,
    session,
    recovery,
    signIn,
    signUp,
    resetPassword,
    updatePassword,
    signInWithGoogle,
    signInWithApple,
  } = useAuth();
  const location = useLocation();
  const from =
    (location.state as { from?: string } | null)?.from &&
    (location.state as { from: string }).from !== "/auth"
      ? (location.state as { from: string }).from
      : "/today";

  const remembered = readRememberedEmail();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(remembered);
  const [password, setPassword] = useState("");
  const [revealPassword, setRevealPassword] = useState(false);
  const [remember, setRemember] = useState(Boolean(remembered));
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="auth-stage flex min-h-dvh items-center justify-center px-7">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  if (session && !recovery) {
    return <Navigate to={from} replace />;
  }

  function resetMessages() {
    setError(null);
    setInfo(null);
  }

  function onRemember(next: boolean) {
    setRemember(next);
    if (!next) writeRememberedEmail(null);
    else if (email.trim()) writeRememberedEmail(email.trim());
  }

  async function onApple() {
    resetMessages();
    setSubmitting(true);
    try {
      const result = await signInWithApple();
      if (result.error) setError(result.error);
    } finally {
      setSubmitting(false);
    }
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

  async function onForgot() {
    resetMessages();
    if (!email.trim()) {
      setError("Enter your email, then try again.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await resetPassword(email);
      if (result.error) setError(result.error);
      else setInfo("Check your email for a link to reset your password.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onEmailSubmit(e: FormEvent) {
    e.preventDefault();
    resetMessages();

    if (recovery) {
      if (password.length < 6) {
        setError("Use at least 6 characters.");
        return;
      }
      setSubmitting(true);
      try {
        const result = await updatePassword(password);
        if (result.error) setError(result.error);
      } finally {
        setSubmitting(false);
      }
      return;
    }

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
        if (result.error) {
          setError(result.error);
        } else if (remember) {
          writeRememberedEmail(email.trim());
        } else {
          writeRememberedEmail(null);
        }
      } else {
        const result = await signUp(email, password, name);
        if (result.error) {
          setError(result.error);
        } else if (result.needsEmailConfirmation) {
          setInfo("Check your email to confirm the account, then log in.");
          setMode("sign-in");
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-stage flex min-h-dvh flex-col">
      <div className="auth-sheet mx-auto flex min-w-0 w-full max-w-[22.5rem] flex-1 flex-col px-7 pt-[max(2.25rem,5.5dvh)] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <img src="/mark.png" alt="MIRIN" className="auth-mark" />
        <h1 className="text-[2rem] font-semibold leading-[1.12] tracking-[-0.03em]">
          {recovery ? (
            <>
              Choose a new
              <br />
              password
            </>
          ) : mode === "sign-in" ? (
            <>
              Log in to
              <br />
              your account
            </>
          ) : (
            <>
              Create your
              <br />
              account
            </>
          )}
        </h1>

        {!configured ? (
          <div className="mt-12">
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
          <>
            <form className="mt-10" onSubmit={onEmailSubmit}>
              {mode === "sign-up" && !recovery ? (
                <LineField
                  id="auth-name"
                  label="Name"
                  type="text"
                  name="name"
                  autoComplete="name"
                  value={name}
                  onChange={setName}
                />
              ) : null}

              {recovery ? null : (
                <LineField
                  id="auth-email"
                  label="Email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={setEmail}
                />
              )}

              <LineField
                id="auth-password"
                label={recovery ? "New password" : "Password"}
                type={revealPassword ? "text" : "password"}
                name="password"
                autoComplete={
                  recovery
                    ? "new-password"
                    : mode === "sign-in"
                      ? "current-password"
                      : "new-password"
                }
                autoCapitalize="off"
                spellCheck={false}
                value={password}
                onChange={(value) => {
                  setPassword(value);
                  if (!value) setRevealPassword(false);
                }}
                minLength={6}
                trailing={
                  <>
                    {password ? (
                      <button
                        type="button"
                        className="auth-reveal"
                        aria-label={revealPassword ? "Hide password" : "Show password"}
                        aria-pressed={revealPassword}
                        onClick={() => setRevealPassword((open) => !open)}
                      >
                        <EyeIcon slashed={revealPassword} />
                      </button>
                    ) : null}
                    {mode === "sign-in" && !recovery ? (
                      <button
                        type="button"
                        className="auth-forgot"
                        onClick={() => void onForgot()}
                        disabled={submitting}
                      >
                        Forgot?
                      </button>
                    ) : null}
                  </>
                }
              />

              {mode === "sign-in" && !recovery ? (
                <label className="auth-remember">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={remember}
                    onChange={(e) => onRemember(e.target.checked)}
                  />
                  <span className="auth-check" aria-hidden="true" />
                  <span>Remember me</span>
                </label>
              ) : null}

              {error ? (
                <p className="mt-4 text-[13px] leading-relaxed text-ink" role="alert">
                  {error}
                </p>
              ) : null}
              {info ? (
                <p className="mt-4 text-[13px] leading-relaxed text-muted" role="status">
                  {info}
                </p>
              ) : null}

              <div className={`auth-actions${error || info ? " is-after-note" : ""}`}>
                <button type="submit" className={primaryBtn} disabled={submitting}>
                  {submitting
                    ? "Working…"
                    : recovery
                      ? "Update password"
                      : mode === "sign-in"
                        ? "Log in"
                        : "Create account"}
                </button>

                {recovery ? null : (
                  <>
                    <button
                      type="button"
                      className={providerBtn}
                      disabled={submitting}
                      onClick={() => void onApple()}
                    >
                      <span className="auth-pill-icon auth-pill-icon-apple">
                        <AppleMark />
                      </span>
                      Continue with Apple
                    </button>
                    <button
                      type="button"
                      className={providerBtn}
                      disabled={submitting}
                      onClick={() => void onGoogle()}
                    >
                      <span className="auth-pill-icon">
                        <GoogleMark />
                      </span>
                      Continue with Google
                    </button>
                  </>
                )}
              </div>
            </form>
          </>
        )}

        {configured && !recovery ? (
          <p className="mt-auto pt-16 text-center text-[0.9375rem] text-muted">
            {mode === "sign-in" ? (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  className="auth-switch"
                  onClick={() => {
                    setMode("sign-up");
                    resetMessages();
                  }}
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  className="auth-switch"
                  onClick={() => {
                    setMode("sign-in");
                    resetMessages();
                  }}
                >
                  Log in
                </button>
              </>
            )}
          </p>
        ) : (
          <div className="mt-auto" />
        )}

        <p className={`text-center text-[13px] text-muted ${configured && !recovery ? "mt-3" : "pt-16"}`}>
          <Link to="/privacy" className="auth-switch font-normal">
            Privacy
          </Link>
        </p>
      </div>
    </div>
  );
}

function LineField({
  id,
  label,
  value,
  onChange,
  trailing,
  ...input
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  trailing?: ReactNode;
} & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id" | "value" | "onChange" | "className" | "placeholder"
>) {
  return (
    <div className="auth-line">
      <div className="auth-line-row">
        <label className="sr-only" htmlFor={id}>
          {label}
        </label>
        <input
          {...input}
          id={id}
          value={value}
          placeholder={label}
          onChange={(e) => onChange(e.target.value)}
          className="quiet-field"
          required
        />
        {trailing}
      </div>
    </div>
  );
}

function EyeIcon({ slashed }: { slashed: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M1.6 9.1C3.2 6.3 5.8 4.7 9 4.7s5.8 1.6 7.4 4.4c-1.6 2.8-4.2 4.4-7.4 4.4s-5.8-1.6-7.4-4.4Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="9.1" r="1.7" stroke="currentColor" strokeWidth="1.25" />
      {slashed ? (
        <path
          d="M3.4 14.2 14.6 4"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
      ) : null}
    </svg>
  );
}

function AppleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M13.2 9.5c0-1.9 1.6-2.8 1.6-2.9-0.9-1.3-2.3-1.5-2.8-1.5-1.2-.1-2.3.7-2.9.7s-1.5-.7-2.5-.7c-1.3 0-2.5.8-3.1 1.9-1.3 2.3-.3 5.7.9 7.6.6.9 1.4 1.9 2.4 1.9 1 0 1.3-.6 2.5-.6s1.5.6 2.5.6 1.7-.9 2.3-1.8c.7-1.1 1-2.1 1-2.2-.1 0-2-.8-2-3zm-1.8-5.3c.5-.6.9-1.5.8-2.3-.7 0-1.6.5-2.2 1.1-.5.5-.9 1.4-.8 2.2.8.1 1.6-.4 2.2-1z"
      />
    </svg>
  );
}
