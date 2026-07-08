interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

/** Minimal on/off control for split activation. */
export function ToggleSwitch({
  checked,
  onChange,
  label,
  disabled = false,
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "relative h-11 w-[52px] shrink-0 rounded-full border border-hairline transition-colors duration-150 disabled:opacity-40",
        checked ? "bg-accent" : "bg-surface-raised",
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className={[
          "absolute top-1/2 block h-7 w-7 -translate-y-1/2 rounded-full bg-bg transition-[left] duration-150",
          checked ? "left-[calc(100%-1.875rem-0.25rem)]" : "left-1",
        ].join(" ")}
      />
    </button>
  );
}
