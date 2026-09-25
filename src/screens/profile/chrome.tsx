import { Link } from "react-router-dom";

export function Chevron({
  direction = "right",
}: {
  direction?: "left" | "right";
}) {
  const d =
    direction === "left" ? "M10 3.5 5.5 8 10 12.5" : "M6 3.5 10.5 8 6 12.5";
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ProfileBack() {
  return (
    <Link
      to="/profile"
      className="glass-btn inline-flex h-11 items-center gap-1 rounded-pill pl-2.5 pr-3.5 text-sm font-medium text-ink"
      aria-label="Back to profile"
    >
      <Chevron direction="left" />
      Profile
    </Link>
  );
}

export const fieldLabel = "text-[13px] font-medium text-muted";

export const inputClass =
  "h-12 w-full rounded-md border border-hairline bg-bg px-3 text-base text-ink placeholder:text-muted transition-colors duration-150 focus:border-muted";
