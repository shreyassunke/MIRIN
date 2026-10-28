import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * Screen header in the Today voice: bold title on the left, one glass
 * capsule on the right. A back capsule sits above the title when the
 * screen is reached from somewhere else.
 */
export function PageHeader({
  title,
  subtitle,
  pill,
  pillLabel,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  pill?: ReactNode;
  pillLabel?: string;
  back?: ReactNode;
}) {
  return (
    <header className="page-header">
      {back ? <div className="page-header-back">{back}</div> : null}
      <div className="page-header-row">
        <div className="page-header-copy">
          <h1 className="page-title">{title}</h1>
          {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
        </div>
        {pill ? (
          <div
            className="header-pill"
            role={pillLabel ? "group" : undefined}
            aria-label={pillLabel}
          >
            {pill}
          </div>
        ) : null}
      </div>
    </header>
  );
}

function BackChevron() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path
        d="M10 3.5 5.5 8 10 12.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HeaderBack({
  to,
  label,
  onClick,
}: {
  to?: string;
  label: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <BackChevron />
      {label}
    </>
  );
  return (
    <div className="header-pill">
      {to ? (
        <Link to={to} aria-label={`Back to ${label}`}>
          {content}
        </Link>
      ) : (
        <button type="button" onClick={onClick}>
          {content}
        </button>
      )}
    </div>
  );
}
