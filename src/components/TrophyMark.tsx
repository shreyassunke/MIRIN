import { useId } from "react";

/**
 * Polished silver cup. The silhouette follows the classic loving cup
 * (wide rim, two handles, turned stem, round foot) and the metal is a
 * single grayscale specular, so it stays inside the logbook palette.
 */
export function TrophyMark({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  const bowl = `${id}-bowl`;
  const rim = `${id}-rim`;
  const foot = `${id}-foot`;
  const mouth = `${id}-mouth`;

  return (
    <svg
      viewBox="0 0 64 80"
      className={["trophy", className].filter(Boolean).join(" ")}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={bowl} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--trophy-edge)" />
          <stop offset="0.16" stopColor="var(--trophy-shade)" />
          <stop offset="0.36" stopColor="var(--trophy-hi)" />
          <stop offset="0.5" stopColor="var(--trophy-mid)" />
          <stop offset="0.72" stopColor="var(--trophy-shade)" />
          <stop offset="1" stopColor="var(--trophy-edge)" />
        </linearGradient>
        <linearGradient id={rim} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--trophy-hi)" />
          <stop offset="0.42" stopColor="var(--trophy-mid)" />
          <stop offset="1" stopColor="var(--trophy-shade)" />
        </linearGradient>
        <linearGradient id={foot} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--trophy-hi)" />
          <stop offset="0.38" stopColor="var(--trophy-mid)" />
          <stop offset="1" stopColor="var(--trophy-shade)" />
        </linearGradient>
        <radialGradient id={mouth} cx="42%" cy="38%" r="68%">
          <stop offset="0" stopColor="var(--trophy-shade)" />
          <stop offset="1" stopColor="var(--trophy-mouth)" />
        </radialGradient>
      </defs>

      <path
        d="M26 23C8 20.6 6 40.4 26 43.6"
        fill="none"
        stroke={`url(#${bowl})`}
        strokeWidth="5.2"
        strokeLinecap="round"
      />
      <path
        d="M38 23C56 20.6 58 40.4 38 43.6"
        fill="none"
        stroke={`url(#${bowl})`}
        strokeWidth="5.2"
        strokeLinecap="round"
      />

      <path
        d="M28.4 42.6C27.6 49 27 57 27.4 64.2H36.6C37 57 36.4 49 35.6 42.6Z"
        fill={`url(#${bowl})`}
      />
      <path
        d="M18 66.2C18.8 62.4 24 60.2 32 60.2C40 60.2 45.2 62.4 46 66.2C46 69.4 40 71.8 32 71.8C24 71.8 18 69.4 18 66.2Z"
        fill={`url(#${foot})`}
      />

      <ellipse cx="32" cy="20" rx="17.2" ry="5.1" fill={`url(#${rim})`} />
      <path
        d="M14.8 20C14 32.4 21.2 42.2 28.6 45.4H35.4C42.8 42.2 50 32.4 49.2 20C49.2 23.4 41.4 25.2 32 25.2C22.6 25.2 14.8 23.4 14.8 20Z"
        fill={`url(#${bowl})`}
      />
      <ellipse cx="32" cy="20.2" rx="11.2" ry="3.05" fill={`url(#${mouth})`} />
      <path
        d="M21.4 16.2C24.2 14.8 28 14.2 32 14.2C36.6 14.2 40.2 15 43 16.4"
        fill="none"
        stroke="var(--trophy-hi)"
        strokeWidth="1.15"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  );
}
