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

/** The frosted track segment chips sit in. */
export const chipTrackClass =
  "glass flex w-fit overflow-hidden rounded-pill p-0.5";
