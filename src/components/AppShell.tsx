import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { getContactLine, getDisplayName } from "../lib/user";

const NAV_ITEMS = [
  { to: "/today", label: "Today" },
  { to: "/progress", label: "Progress" },
  { to: "/split", label: "Split" },
  { to: "/profile", label: "Profile" },
];

function navClass({ isActive }: { isActive: boolean }) {
  return [
    "rounded-md px-3 py-3 text-sm font-medium transition-colors duration-150",
    isActive ? "text-ink" : "text-muted hover:text-ink",
  ].join(" ");
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
            <span className="text-lg font-semibold tracking-tight">
              MIRIN
            </span>
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
        {/* Mobile top bar: logo in the corner */}
        <header className="flex items-center gap-2.5 border-b border-hairline px-4 py-2.5 md:hidden">
          <img
            src="/logo.png"
            alt="MIRIN"
            className="h-6 w-auto rounded"
            width="24"
            height="24"
          />
          <span className="text-sm font-semibold tracking-tight">MIRIN</span>
          {displayName ? (
            <span className="ml-auto max-w-[40%] truncate text-[13px] text-muted">
              {displayName}
            </span>
          ) : null}
        </header>

        <main className="mx-auto w-full max-w-2xl px-4 pb-28 pt-5 md:px-8 md:pb-12 md:pt-10">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-hairline bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                "flex-1 py-4 text-center text-[13px] font-medium transition-colors duration-150",
                isActive ? "text-ink" : "text-muted",
              ].join(" ")
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
