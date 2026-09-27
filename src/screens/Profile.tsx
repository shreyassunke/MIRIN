import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useOutlet } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { SegmentedTabs } from "../components/SegmentedTabs";
import { AvatarEditor } from "../components/AvatarEditor";
import { chipClass } from "../components/chip";
import { MODE_GLYPHS, NavGlyph } from "../components/NavGlyph";
import { useAuth } from "../auth/AuthProvider";
import {
  APPEARANCE_MODES,
  MODE_LABEL,
  saveAppearance,
  useAppearanceChoice,
} from "../lib/appearance";
import { AVATAR_KEY, useSettingValue } from "../lib/profile";
import { getContactLine, getDisplayName } from "../lib/user";
import { Chevron } from "./profile/chrome";

const secondaryBtn =
  "glass-btn h-12 rounded-pill px-5 text-sm font-medium text-ink";

// Start the chart chunk while the account view is on screen, so the
// page-turn does not wait on a network fetch.
void import("./Trends");

export function Profile() {
  const outlet = useOutlet();
  const navigate = useNavigate();
  const pending = useRef<(() => void) | null>(null);
  const activeTransition = useRef<ViewTransition | null>(null);

  const settle = useCallback(() => {
    pending.current?.();
    pending.current = null;
  }, []);

  const switchPane = useCallback(
    (to: string, direction: "forward" | "back") => {
      const go = () => navigate(to);
      if (typeof document.startViewTransition !== "function") {
        go();
        return;
      }

      document.documentElement.dataset.paneSlide = direction;
      try {
        activeTransition.current?.skipTransition();
      } catch {
        // The previous turn already finished.
      }
      const transition = document.startViewTransition(
        () =>
          new Promise<void>((resolve) => {
            const timer = window.setTimeout(resolve, 800);
            pending.current = () => {
              window.clearTimeout(timer);
              resolve();
            };
            go();
          }),
      );
      activeTransition.current = transition;
      void transition.ready.catch(() => {});
      const clearSlide = () => {
        if (activeTransition.current !== transition) return;
        delete document.documentElement.dataset.paneSlide;
        activeTransition.current = null;
      };
      void transition.finished.then(clearSlide, clearSlide);
    },
    [navigate],
  );

  useEffect(() => {
    return () => {
      delete document.documentElement.dataset.paneSlide;
      pending.current?.();
      pending.current = null;
    };
  }, []);

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
      </header>

      <div className="mb-6">
        <SegmentedTabs
          ariaLabel="Profile views"
          onPaneSwitch={switchPane}
          items={[
            { to: "/profile", label: "Account", end: true },
            { to: "/profile/progress", label: "Progress" },
          ]}
        />
      </div>

      <div className="profile-pane">
        <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
          <SettledPane settle={settle}>
            {outlet ?? <ProfileAccount />}
          </SettledPane>
        </Suspense>
      </div>
    </div>
  );
}

/** Resolves the in-flight page-turn once this body has committed and laid out. */
function SettledPane({
  settle,
  children,
}: {
  settle: () => void;
  children: ReactNode;
}) {
  useLayoutEffect(() => {
    let cancelled = false;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        if (!cancelled) settle();
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  });
  return children;
}

export function ProfileAccount() {
  const { user, signOut } = useAuth();
  const { mode } = useAppearanceChoice();
  const avatar = useSettingValue(AVATAR_KEY);
  const [editorOpen, setEditorOpen] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [glyphsReady, setGlyphsReady] = useState(false);
  const displayName = getDisplayName(user);
  const contact = getContactLine(user);

  useEffect(() => {
    const id = requestAnimationFrame(() => setGlyphsReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div>
      <section className="glass flex items-center gap-4 rounded-xl p-4">
        <button
          type="button"
          className="relative z-10 shrink-0 rounded-pill transition-transform duration-150 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
          aria-label="Edit photo"
          onClick={() => {
            if (avatar === null) return;
            setEditorOpen(true);
          }}
        >
          <Avatar
            src={avatar || null}
            name={displayName}
            email={contact}
            size={64}
          />
          <span className="pointer-events-none absolute -right-0.5 -bottom-0.5 flex h-6 w-6 items-center justify-center rounded-pill border border-glass-border bg-bg text-ink shadow-float">
            <CameraIcon />
          </span>
        </button>
        <Link
          to="/profile/details"
          className="relative -my-4 -mr-4 flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-r-xl py-4 pr-4 transition-colors duration-150 hover:bg-wash"
        >
          <span className="sr-only">Details</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold tracking-tight">
              {displayName || "No name set"}
            </span>
            {contact ? (
              <span className="mt-0.5 block truncate text-[13px] text-muted">
                {contact}
              </span>
            ) : null}
          </span>
          <span className="text-muted">
            <Chevron />
          </span>
        </Link>
      </section>

      <div
        role="group"
        aria-label="Appearance"
        className="glass mt-8 flex w-full max-w-sm overflow-hidden rounded-pill p-0.5"
      >
        {APPEARANCE_MODES.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={mode === option}
            aria-label={MODE_LABEL[option]}
            onClick={() => void saveAppearance(option)}
            className={`${chipClass(mode === option)} appearance-choice h-11 flex-1 px-3 text-sm`}
          >
            {option === "system" ? (
              MODE_LABEL.system
            ) : (
              <NavGlyph
                glyph={MODE_GLYPHS[option]}
                active={mode === option}
                animate={glyphsReady}
                className="nav-glyph-sm nav-glyph-tone"
              />
            )}
          </button>
        ))}
      </div>

      <div className="mt-8">
        <button
          type="button"
          className={secondaryBtn}
          onClick={() => {
            setSignOutError(null);
            void signOut().then((result) => {
              if (result.error) setSignOutError(result.error);
            });
          }}
        >
          Sign out
        </button>
        {signOutError ? (
          <p className="mt-2 text-[13px] leading-relaxed text-ink" role="alert">
            {signOutError}
          </p>
        ) : null}
      </div>

      <section className="mt-10">
        <h2 className="text-[13px] font-medium text-muted">About</h2>
        <p className="mt-1.5 max-w-[65ch] text-[13px] leading-relaxed text-muted">
          Form videos play through the embedded YouTube player and stay the
          property of their creators. By watching them here you agree to the{" "}
          <a
            href="https://www.youtube.com/t/terms"
            target="_blank"
            rel="noreferrer"
            className="text-ink transition-colors duration-150 hover:text-muted"
          >
            YouTube Terms of Service
          </a>
          .
        </p>
      </section>

      <AvatarEditor
        open={editorOpen}
        storedSrc={avatar || ""}
        name={displayName}
        email={contact}
        onClose={() => setEditorOpen(false)}
      />
    </div>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
      <path
        d="M2.25 5.75h2.1l.7-1.4h5.9l.7 1.4h2.1a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1h-11.5a1 1 0 0 1-1-1v-5.5a1 1 0 0 1 1-1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <circle
        cx="8"
        cy="9.1"
        r="1.7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
      />
    </svg>
  );
}
