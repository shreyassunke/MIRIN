/**
 * The one segment-chip voice: unit switches, view tabs, mode pickers. Callers
 * append their own height and padding, since mid-workout controls need a
 * larger target than a dense header switch.
 */
export const chipClass = (active: boolean) =>
  [
    "glass-chip inline-flex items-center justify-center rounded-pill font-medium",
    active ? "glass-chip-active text-ink" : "text-muted hover:text-ink",
  ].join(" ");

/** Control glass. The active chip is a lens inside this track, not a second blur. */
export const chipTrackClass =
  "glass-control flex w-fit overflow-hidden rounded-pill p-0.5";
