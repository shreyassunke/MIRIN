import { SegmentedTabs } from "./SegmentedTabs";

/** Account / Measurements switch shared by the Profile views. */
export function ProfileNav() {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
      <p className="mt-1 text-sm text-muted">
        Account details and body measurements for this log
      </p>
      <div className="mt-4">
        <SegmentedTabs
          ariaLabel="Profile views"
          items={[
            { to: "/profile", label: "Account", end: true },
            { to: "/profile/measurements", label: "Measurements" },
          ]}
        />
      </div>
    </header>
  );
}
