import type { ReactNode, SVGProps } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { getContactLine, getDisplayName } from "../lib/user";

const NAV_ITEMS = [
  { to: "/today", label: "Today", Icon: IconToday },
  { to: "/progress", label: "Progress", Icon: IconProgress },
  { to: "/split", label: "Split", Icon: IconSplit },
  { to: "/profile", label: "Profile", Icon: IconProfile },
] as const;

function navClass({ isActive }: { isActive: boolean }) {
  return [
    "rounded-md px-3 py-3 text-sm font-medium transition-colors duration-150",
    isActive ? "text-ink" : "text-muted hover:text-ink",
  ].join(" ");
}

function IconToday(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect
        x="4"
        y="5"
        width="16"
        height="15"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M8 3.5v3M16 3.5v3M4 10h16"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M9 14.5h2.5M14.5 14.5H17"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconProgress(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M4 16.5 9 11l3.5 3.5L20 7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 7h5v5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSplit(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M5 8h14M5 12h14M5 16h14"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="9" cy="8" r="1.35" fill="currentColor" />
      <circle cx="14" cy="12" r="1.35" fill="currentColor" />
      <circle cx="11" cy="16" r="1.35" fill="currentColor" />
    </svg>
  );
}

function IconProfile(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx="12" cy="9" r="3.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M5.5 18.5c1.4-2.4 3.5-3.6 6.5-3.6s5.1 1.2 6.5 3.6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const displayName = getDisplayName(user);
  const contact = getContactLine(user);

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
              {item.label}
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
        <main className="mx-auto w-full max-w-2xl px-4 pb-32 pt-[max(1.25rem,env(safe-area-inset-top))] md:px-8 md:pb-12 md:pt-10">
          {children}
        </main>
      </div>

      {/* Mobile floating pill nav — compact, centered like Tinder */}
      <nav
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
        aria-label="Primary"
      >
        <div className="pointer-events-auto flex items-stretch gap-0.5 rounded-pill glass p-1 shadow-glass">
          {NAV_ITEMS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                [
                  "glass-chip flex min-h-11 w-[4.25rem] flex-col items-center justify-center gap-0.5 rounded-pill px-1 py-1 text-[10px] font-medium",
                  isActive
                    ? "glass-chip-active text-ink"
                    : "text-muted hover:text-ink",
                ].join(" ")
              }
            >
              <Icon className="h-[1.125rem] w-[1.125rem]" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
