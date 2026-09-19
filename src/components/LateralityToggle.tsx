import { chipClass, chipTrackClass } from "./chip";
import type { Laterality } from "../lib/laterality";

interface LateralityToggleProps {
  value: Laterality;
  onChange: (value: Laterality) => void;
  /** Pair/single for dumbbells; both-arms/single for cables and machines. */
  variant?: "pair" | "arms";
}

export function LateralityToggle({
  value,
  onChange,
  variant = "arms",
}: LateralityToggleProps) {
  const bilateralLabel = variant === "pair" ? "Pair" : "Both arms";
  return (
    <div role="group" aria-label="Arm variation" className={chipTrackClass}>
      <button
        type="button"
        aria-pressed={value === "bilateral"}
        onClick={() => onChange("bilateral")}
        className={`${chipClass(value === "bilateral")} h-9 px-3 text-[13px]`}
      >
        {bilateralLabel}
      </button>
      <button
        type="button"
        aria-pressed={value === "unilateral"}
        onClick={() => onChange("unilateral")}
        className={`${chipClass(value === "unilateral")} h-9 px-3 text-[13px]`}
      >
        Single arm
      </button>
    </div>
  );
}
