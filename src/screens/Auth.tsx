import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type RefObject,
} from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { authHandoffPending, useAuth } from "../auth/AuthProvider";
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
    handoff,
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
  const stageRef = useRef<HTMLDivElement>(null);
  useAuthDepth(stageRef);

  if (loading) {
    return (
      <div className="auth-stage flex min-h-dvh items-center justify-center px-7">
        {authHandoffPending() ? null : (
          <p className="text-sm text-muted">Loading…</p>
        )}
      </div>
    );
  }

  if (session && !recovery && !handoff) {
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
    <div
      ref={stageRef}
      className={`auth-stage flex min-h-dvh flex-col${handoff ? " is-leaving" : ""}`}
    >
      <div className="auth-depth" aria-hidden="true">
        <img src="/mark.png" alt="" className="auth-depth-figure auth-depth-far" />
        <img src="/mark.png" alt="" className="auth-depth-figure auth-depth-near" />
      </div>
      <div className="auth-sheet mx-auto flex min-w-0 w-full max-w-[22.5rem] flex-1 flex-col px-7 pt-[max(4.5rem,12dvh)] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <h1 className="text-[2rem] font-semibold leading-[1.12] tracking-[-0.03em]">
          {recovery ? (
            <>
              Choose a new
              <br />
              password
            </>
          ) : mode === "sign-in" ? (
            "Log in"
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
                      className={`${providerBtn} auth-provider`}
                      disabled={submitting}
                      onClick={() => void onApple()}
                    >
                      <span className="auth-pill-icon">
                        <AppleMark />
                      </span>
                      <ProviderLabel>Continue with Apple</ProviderLabel>
                    </button>
                    <button
                      type="button"
                      className={`${providerBtn} auth-provider`}
                      disabled={submitting}
                      onClick={() => void onGoogle()}
                    >
                      <span className="auth-pill-icon">
                        <GoogleMark />
                      </span>
                      <ProviderLabel>Continue with Google</ProviderLabel>
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

function useAuthDepth(stageRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let x = 0;
    let y = 0;
    const paint = () => {
      frame = 0;
      stage.style.setProperty("--depth-x", x.toFixed(3));
      stage.style.setProperty("--depth-y", y.toFixed(3));
    };
    const aim = (nx: number, ny: number) => {
      x = Math.max(-1, Math.min(1, nx));
      y = Math.max(-1, Math.min(1, ny));
      if (!frame) frame = requestAnimationFrame(paint);
    };

    const onPointer = (event: PointerEvent) => {
      const box = stage.getBoundingClientRect();
      if (!box.width || !box.height) return;
      aim(
        ((event.clientX - box.left) / box.width - 0.5) * 2,
        ((event.clientY - box.top) / box.height - 0.5) * 2,
      );
    };
    const onOrient = (event: DeviceOrientationEvent) => {
      if (event.gamma == null || event.beta == null) return;
      aim(event.gamma / 26, (event.beta - 42) / 30);
    };

    const fine = window.matchMedia("(pointer: fine)").matches;
    stage.addEventListener("pointermove", onPointer);
    if (!fine) window.addEventListener("deviceorientation", onOrient);

    return () => {
      stage.removeEventListener("pointermove", onPointer);
      window.removeEventListener("deviceorientation", onOrient);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [stageRef]);
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

function ProviderLabel({ children }: { children: string }) {
  return (
    <span className="auth-provider-label">
      <span className="auth-provider-sizer" aria-hidden="true">
        Continue with Google
      </span>
      <span className="auth-provider-word">{children}</span>
    </span>
  );
}

function AppleMark() {
  return (
    <svg
      className="auth-mark-apple"
      width="18"
      height="21"
      viewBox="2.9 3.2 16.1 18.9"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M16.37 12.73c-.03-2.48 2.03-3.67 2.12-3.73-1.16-1.69-2.96-1.92-3.6-1.95-1.53-.16-3 .9-3.78.9-.78 0-1.98-.88-3.26-.85-1.67.02-3.22.97-4.08 2.47-1.74 3.02-.45 7.49 1.25 9.94.83 1.2 1.82 2.54 3.12 2.49 1.25-.05 1.72-.81 3.23-.81s1.94.81 3.26.78c1.35-.02 2.2-1.22 3.02-2.42.95-1.39 1.34-2.74 1.36-2.81-.03-.01-2.61-1-2.64-3.97zM14.32 6.3c.69-.83 1.15-1.99 1.02-3.15-1 .04-2.2.66-2.91 1.5-.64.74-1.2 1.92-1.05 3.05 1.11.09 2.25-.56 2.94-1.4z"
      />
    </svg>
  );
}
