import { Suspense, useEffect, useState } from "react";
import { Link, useOutlet } from "react-router-dom";
import { Avatar } from "../components/Avatar";
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
import { Chevron, ProfileBack } from "./profile/chrome";

const secondaryBtn =
  "glass-btn h-12 rounded-pill px-5 text-sm font-medium text-ink";

export function Profile() {
  const outlet = useOutlet();

  return (
    <div className="flex h-[calc(100dvh-max(1.25rem,env(safe-area-inset-top))-10rem)] min-h-0 flex-col md:h-[calc(100dvh-5.5rem)]">
      <h1 className="sr-only">Profile</h1>
      <div className="relative min-h-0 flex-1">
        <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
          {outlet}
        </Suspense>
        <Link
          to="/profile/account"
          className="glass-btn absolute top-0 right-0 z-20 flex h-11 w-11 items-center justify-center rounded-pill text-ink"
          aria-label="Account"
        >
          <GearIcon />
        </Link>
      </div>
    </div>
  );
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
      <header className="mb-6">
        <ProfileBack />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Account</h1>
      </header>

      <section className="identity-card glass flex items-center gap-4 rounded-xl p-4">
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
          className="identity-link relative z-10 -my-4 -mr-4 flex min-h-16 min-w-0 flex-1 items-center gap-3 py-4 pr-4"
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

function GearIcon() {
  return (
    <svg viewBox="0 0 256 256" className="h-[1.375rem] w-[1.375rem]" aria-hidden="true">
      <path
        fill="currentColor"
        d="M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Zm88-29.84q.06-2.16,0-4.32l14.92-18.64a8,8,0,0,0,1.48-7.06,107.21,107.21,0,0,0-10.88-26.25,8,8,0,0,0-6-3.93l-23.72-2.64q-1.48-1.56-3-3L186,40.54a8,8,0,0,0-3.94-6,107.71,107.71,0,0,0-26.25-10.87,8,8,0,0,0-7.06,1.49L130.16,40Q128,40,125.84,40L107.2,25.11a8,8,0,0,0-7.06-1.48A107.6,107.6,0,0,0,73.89,34.51a8,8,0,0,0-3.93,6L67.32,64.27q-1.56,1.49-3,3L40.54,70a8,8,0,0,0-6,3.94,107.71,107.71,0,0,0-10.87,26.25,8,8,0,0,0,1.49,7.06L40,125.84Q40,128,40,130.16L25.11,148.8a8,8,0,0,0-1.48,7.06,107.21,107.21,0,0,0,10.88,26.25,8,8,0,0,0,6,3.93l23.72,2.64q1.49,1.56,3,3L70,215.46a8,8,0,0,0,3.94,6,107.71,107.71,0,0,0,26.25,10.87,8,8,0,0,0,7.06-1.49L125.84,216q2.16.06,4.32,0l18.64,14.92a8,8,0,0,0,7.06,1.48,107.21,107.21,0,0,0,26.25-10.88,8,8,0,0,0,3.93-6l2.64-23.72q1.56-1.48,3-3L215.46,186a8,8,0,0,0,6-3.94,107.71,107.71,0,0,0,10.87-26.25,8,8,0,0,0-1.49-7.06Zm-16.1-6.5a73.93,73.93,0,0,1,0,8.68,8,8,0,0,0,1.74,5.48l14.19,17.73a91.57,91.57,0,0,1-6.23,15L187,173.11a8,8,0,0,0-5.1,2.64,74.11,74.11,0,0,1-6.14,6.14,8,8,0,0,0-2.64,5.1l-2.51,22.58a91.32,91.32,0,0,1-15,6.23l-17.74-14.19a8,8,0,0,0-5-1.75h-.48a73.93,73.93,0,0,1-8.68,0,8,8,0,0,0-5.48,1.74L100.45,215.8a91.57,91.57,0,0,1-15-6.23L82.89,187a8,8,0,0,0-2.64-5.1,74.11,74.11,0,0,1-6.14-6.14,8,8,0,0,0-5.1-2.64L46.43,170.6a91.32,91.32,0,0,1-6.23-15l14.19-17.74a8,8,0,0,0,1.74-5.48,73.93,73.93,0,0,1,0-8.68,8,8,0,0,0-1.74-5.48L40.2,100.45a91.57,91.57,0,0,1,6.23-15L69,82.89a8,8,0,0,0,5.1-2.64,74.11,74.11,0,0,1,6.14-6.14A8,8,0,0,0,82.89,69L85.4,46.43a91.32,91.32,0,0,1,15-6.23l17.74,14.19a8,8,0,0,0,5.48,1.74,73.93,73.93,0,0,1,8.68,0,8,8,0,0,0,5.48-1.74L155.55,40.2a91.57,91.57,0,0,1,15,6.23L173.11,69a8,8,0,0,0,2.64,5.1,74.11,74.11,0,0,1,6.14,6.14,8,8,0,0,0,5.1,2.64l22.58,2.51a91.32,91.32,0,0,1,6.23,15l-14.19,17.74A8,8,0,0,0,199.87,123.66Z"
      />
    </svg>
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
