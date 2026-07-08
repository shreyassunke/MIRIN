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
      className="-my-1.5 shrink-0 rounded-full p-1.5 disabled:opacity-40"
    >
      <span
        aria-hidden="true"
        className={[
          "relative block h-[31px] w-[51px] rounded-full transition-colors duration-150 ease-out-quint",
          checked ? "bg-accent" : "bg-hairline",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-[2px] block size-[27px] rounded-full shadow-float transition-[left] duration-150 ease-out-quint",
            checked ? "left-[22px] bg-bg" : "left-[2px] bg-ink",
          ].join(" ")}
        />
      </span>
    </button>
  );
}
