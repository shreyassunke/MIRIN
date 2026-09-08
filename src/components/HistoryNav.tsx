import { SegmentedTabs } from "./SegmentedTabs";

/** Sessions / Progress switch shared by History views. */
export function HistoryNav() {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">History</h1>
      <p className="mt-1 text-sm text-muted">
        Past sessions, lift trends, and PR targets
      </p>
      <div className="mt-4">
        <SegmentedTabs
          ariaLabel="History views"
          items={[
            { to: "/history", label: "Sessions", end: true },
            { to: "/history/progress", label: "Progress" },
          ]}
        />
      </div>
    </header>
  );
}
