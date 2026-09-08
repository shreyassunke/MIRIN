import { NavLink } from "react-router-dom";

export interface SegmentedTab {
  to: string;
  label: string;
  /** Match the path exactly, so a parent tab does not stay lit on children. */
  end?: boolean;
}

const tabClass = ({ isActive }: { isActive: boolean }) =>
  [
    "glass-chip inline-flex h-9 items-center justify-center rounded-pill px-4 text-[13px] font-medium",
    isActive ? "glass-chip-active text-ink" : "text-muted hover:text-ink",
  ].join(" ");

/** Route-backed segmented control: the in-section view switcher. */
export function SegmentedTabs({
  items,
  ariaLabel,
}: {
  items: SegmentedTab[];
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="glass flex w-fit overflow-hidden rounded-pill p-0.5"
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={tabClass}
        >
          {item.label}
        </NavLink>
      ))}
    </div>
  );
}
