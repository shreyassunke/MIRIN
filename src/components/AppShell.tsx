import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { AVATAR_KEY, useSettingValue } from "../lib/profile";
import { getContactLine, getDisplayName } from "../lib/user";
import { Avatar } from "./Avatar";
import { GoalCeremonyProvider } from "./GoalCeremony";
import { NAV_GLYPHS, NavGlyph } from "./NavGlyph";

const NAV_ITEMS = [
  { to: "/today", label: "Today", glyph: NAV_GLYPHS.today },
  { to: "/history", label: "History", glyph: NAV_GLYPHS.history },
  { to: "/log", label: "Log", glyph: NAV_GLYPHS.log },
  { to: "/split", label: "Split", glyph: NAV_GLYPHS.split },
  { to: "/profile", label: "Profile", glyph: NAV_GLYPHS.profile },
] as const;

function ProfileIcon({
  active,
  animate,
  src,
}: {
  active: boolean;
  animate: boolean;
  src: string | null;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        draggable={false}
        decoding="async"
        className={[
          "nav-avatar",
          active ? "nav-avatar-on" : "",
          animate ? "nav-avatar-animate" : "",
        ].join(" ")}
      />
    );
  }
  return (
    <NavGlyph
      glyph={NAV_GLYPHS.profile}
      active={active}
      animate={animate}
    />
  );
}

function navClass({ isActive }: { isActive: boolean }) {
  return [
    "flex items-center gap-2.5 rounded-md px-3 py-3 text-sm font-medium transition-colors duration-150",
    isActive ? "text-ink" : "text-muted hover:text-ink",
  ].join(" ");
}

function isPlainPointer(event: PointerEvent<HTMLAnchorElement>) {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

function isPlainClick(event: MouseEvent<HTMLAnchorElement>) {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const switchedOnDownRef = useRef<string | null>(null);
  const displayName = getDisplayName(user);
  const contact = getContactLine(user);
  const avatar = useSettingValue(AVATAR_KEY);
  const [canAnimate, setCanAnimate] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setCanAnimate(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleTabPointerDown = (
    to: string,
    event: PointerEvent<HTMLAnchorElement>,
  ) => {
    if (!isPlainPointer(event)) return;
    if (pathname === to) {
      switchedOnDownRef.current = null;
      return;
    }
    switchedOnDownRef.current = to;
    flushSync(() => {
      navigate(to);
    });
  };

  const handleTabClick = (to: string, event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(event)) return;
    if (switchedOnDownRef.current === to) {
      switchedOnDownRef.current = null;
      event.preventDefault();
      return;
    }
    switchedOnDownRef.current = null;
    if (pathname === to && window.scrollY > 0) {
      event.preventDefault();
      window.scrollTo({
        top: 0,
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    }
  };

  return (
    <GoalCeremonyProvider>
    <div className="min-h-dvh bg-bg text-ink md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-48 shrink-0 border-r border-hairline md:flex md:flex-col">
        <div className="sticky top-0 flex min-h-dvh flex-col gap-1 px-4 py-8">
          <span className="mb-6 flex items-center gap-2.5 px-3">
            <img
              src="/logo.png"
              alt=""
              className="h-7 w-auto rounded"
              width="28"
              height="28"
            />
            <span className="text-lg font-semibold tracking-tight">MIRIN</span>
          </span>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={navClass}
              onPointerDown={(event) => handleTabPointerDown(item.to, event)}
              onClick={(event) => handleTabClick(item.to, event)}
            >
              {({ isActive }) => (
                <>
                  <NavGlyph
                    glyph={item.glyph}
                    active={isActive}
                    animate={canAnimate}
                    className="nav-glyph-sm"
                  />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
          <div className="mt-auto flex items-center gap-2.5 border-t border-hairline pt-4">
            <Avatar
              src={avatar || null}
              name={displayName}
              email={contact}
              size={32}
            />
            <NavLink
              to="/profile"
              className="block min-w-0 flex-1 rounded-md px-1 py-2 transition-colors duration-150 hover:bg-wash"
            >
              {displayName ? (
                <p className="truncate text-[13px] font-medium text-ink">
                  {displayName}
                </p>
              ) : null}
              {contact ? (
                <p className="truncate text-[12px] text-muted">{contact}</p>
              ) : null}
              {!displayName && !contact ? (
                <p className="text-[13px] text-muted">Profile</p>
              ) : null}
            </NavLink>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <main className="mx-auto w-full max-w-2xl px-4 pb-40 pt-[max(1.25rem,env(safe-area-inset-top))] md:px-8 md:pb-12 md:pt-10">
          {children}
        </main>
      </div>

      <nav
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
        aria-label="Primary"
      >
        <div className="nav-pill-track pointer-events-auto flex w-full items-stretch rounded-pill glass">
          {NAV_ITEMS.map(({ to, label, glyph }) => (
            <NavLink
              key={to}
              to={to}
              aria-label={label}
              className="nav-pill-item relative min-w-0 flex-1"
              onPointerDown={(event) => handleTabPointerDown(to, event)}
              onClick={(event) => handleTabClick(to, event)}
            >
              {({ isActive }) => (
                <span className="nav-pill-label flex h-12 w-full items-center justify-center rounded-pill">
                  {to === "/profile" ? (
                    <ProfileIcon
                      active={isActive}
                      animate={canAnimate}
                      src={avatar || null}
                    />
                  ) : (
                    <NavGlyph
                      glyph={glyph}
                      active={isActive}
                      animate={canAnimate}
                    />
                  )}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
    </GoalCeremonyProvider>
  );
}
