import { NavLink } from "react-router-dom";
import { chipClass, chipTrackClass } from "./chip";

export interface SegmentedTab {
  to: string;
  label: string;
  /** Match the path exactly, so a parent tab does not stay lit on children. */
  end?: boolean;
}

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `${chipClass(isActive)} h-9 px-4 text-[13px]`;

/** Route-backed segmented control: the in-section view switcher. */
export function SegmentedTabs({
  items,
  ariaLabel,
}: {
  items: SegmentedTab[];
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className={chipTrackClass}>
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
