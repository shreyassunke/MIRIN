import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { getContactLine, getDisplayName } from "../lib/user";
import { NAV_GLYPHS, NavGlyph } from "./NavGlyph";

const NAV_ITEMS = [
  { to: "/today", label: "Today", glyph: NAV_GLYPHS.today },
  { to: "/history", label: "History", glyph: NAV_GLYPHS.history },
  { to: "/log", label: "Log", glyph: NAV_GLYPHS.log },
  { to: "/split", label: "Split", glyph: NAV_GLYPHS.split },
  { to: "/profile", label: "Profile", glyph: NAV_GLYPHS.profile },
] as const;

function activeNavIndex(pathname: string): number {
  const exact = NAV_ITEMS.findIndex((item) => item.to === pathname);
  if (exact >= 0) return exact;
  // Nested routes (e.g. /history/session/:id) keep the parent tab lit.
  return NAV_ITEMS.findIndex((item) => pathname.startsWith(`${item.to}/`));
}

function navClass({ isActive }: { isActive: boolean }) {
  return [
    "flex items-center gap-2.5 rounded-md px-3 py-3 text-sm font-medium transition-colors duration-150",
    isActive ? "text-ink" : "text-muted hover:text-ink",
  ].join(" ");
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const displayName = getDisplayName(user);
  const contact = getContactLine(user);
  const activeIndex = activeNavIndex(location.pathname);

  const trackRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [indicator, setIndicator] = useState({
    x: 0,
    width: 0,
    ready: false,
  });
  const [canAnimate, setCanAnimate] = useState(false);
  const [settling, setSettling] = useState(false);
  const prevIndex = useRef(activeIndex);

  const measureIndicator = useCallback(() => {
    const track = trackRef.current;
    const item = itemRefs.current[activeIndex];
    if (!track || !item || activeIndex < 0) {
      setIndicator((s) => ({ ...s, ready: false }));
      return;
    }
    const trackRect = track.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    setIndicator({
      x: itemRect.left - trackRect.left,
      width: itemRect.width,
      ready: true,
    });
  }, [activeIndex]);

  useLayoutEffect(() => {
    measureIndicator();
    // Enable slide transitions only after the first layout so cold open
    // doesn't animate in from x=0.
    if (!canAnimate) {
      const id = requestAnimationFrame(() => setCanAnimate(true));
      return () => cancelAnimationFrame(id);
    }
  }, [measureIndicator, location.pathname, canAnimate]);

  useEffect(() => {
    window.addEventListener("resize", measureIndicator);
    return () => window.removeEventListener("resize", measureIndicator);
  }, [measureIndicator]);

  // Soft glass “settle” flash when the active tab changes.
  useEffect(() => {
    if (prevIndex.current === activeIndex || activeIndex < 0) {
      prevIndex.current = activeIndex;
      return;
    }
    prevIndex.current = activeIndex;
    setSettling(true);
    const t = window.setTimeout(() => setSettling(false), 320);
    return () => window.clearTimeout(t);
  }, [activeIndex]);

  return (
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
            <NavLink key={item.to} to={item.to} className={navClass}>
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
          <div className="mt-auto border-t border-hairline pt-4">
            <NavLink
              to="/profile"
              className="block rounded-md px-3 py-2 transition-colors duration-150 hover:bg-surface"
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

      {/* Floating glass pill — sliding frosted active indicator */}
      <nav
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
        aria-label="Primary"
      >
        <div
          ref={trackRef}
          className="nav-pill-track pointer-events-auto relative flex w-full items-stretch rounded-pill glass p-2 shadow-glass"
        >
          <span
            aria-hidden="true"
            className={[
              "nav-pill-indicator",
              indicator.ready ? "nav-pill-indicator-ready" : "",
              canAnimate ? "nav-pill-indicator-animate" : "",
              settling ? "nav-pill-indicator-settle" : "",
            ].join(" ")}
            style={{
              width: indicator.width,
              transform: `translateX(${indicator.x}px)`,
            }}
          />
          {NAV_ITEMS.map(({ to, label, glyph }, index) => (
            <NavLink
              key={to}
              to={to}
              aria-label={label}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              className="nav-pill-item relative z-10 min-w-0 flex-1"
            >
              {({ isActive }) => (
                <span className="nav-pill-label flex h-12 w-full items-center justify-center rounded-pill">
                  <NavGlyph
                    glyph={glyph}
                    active={isActive}
                    animate={canAnimate}
                  />
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
