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
      className="switch-hit -my-1.5 shrink-0 rounded-full p-1.5 disabled:opacity-40"
    >
      <span
        aria-hidden="true"
        className={[
          "switch-track relative block h-[31px] w-[51px] rounded-full",
          checked ? "switch-track-on" : "",
        ].join(" ")}
      >
        <span
          className={[
            "switch-knob absolute top-[2px] block size-[27px] rounded-full",
            checked ? "switch-knob-on left-[22px]" : "left-[2px]",
          ].join(" ")}
        />
      </span>
    </button>
  );
}
