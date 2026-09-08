import { NavLink } from "react-router-dom";

const tabClass = ({ isActive }: { isActive: boolean }) =>
  [
    "glass-chip inline-flex h-9 items-center justify-center rounded-pill px-4 text-[13px] font-medium",
    isActive ? "glass-chip-active text-ink" : "text-muted hover:text-ink",
  ].join(" ");

/** Sessions / Progress switch shared by History views. */
export function HistoryNav() {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">History</h1>
      <p className="mt-1 text-sm text-muted">
        Past sessions, lift trends, and PR targets
      </p>
      <div
        role="group"
        aria-label="History views"
        className="mt-4 glass flex w-fit overflow-hidden rounded-pill p-0.5"
      >
        <NavLink to="/history" end className={tabClass}>
          Sessions
        </NavLink>
        <NavLink to="/history/progress" className={tabClass}>
          Progress
        </NavLink>
      </div>
    </header>
  );
}
