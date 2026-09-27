import type { MouseEvent } from "react";
import { NavLink, useLocation } from "react-router-dom";
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
function tabMatches(pathname: string, item: SegmentedTab) {
  if (item.end) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
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

export function SegmentedTabs({
  items,
  ariaLabel,
  onPaneSwitch,
}: {
  items: SegmentedTab[];
  ariaLabel: string;
  /**
   * Plain clicks call this instead of following the link, so the section can
   * run a view transition around the navigation. Modified clicks still open
   * a new tab.
   */
  onPaneSwitch?: (to: string, direction: "forward" | "back") => void;
}) {
  const { pathname } = useLocation();
  const current = items.findIndex((item) => tabMatches(pathname, item));

  return (
    <div role="group" aria-label={ariaLabel} className={chipTrackClass}>
      {items.map((item, index) => {
        const leaving = onPaneSwitch != null && index !== current;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={(event) => {
              if (!leaving || !isPlainClick(event)) return;
              event.preventDefault();
              onPaneSwitch?.(item.to, index > current ? "forward" : "back");
            }}
            className={tabClass}
          >
            {item.label}
          </NavLink>
        );
      })}
    </div>
  );
}
