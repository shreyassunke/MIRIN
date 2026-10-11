import { useEffect, type KeyboardEvent } from "react";
import { stationsForMuscle, type GymMachineId } from "../lib/library";
import { MachineThumb } from "./MachineThumb";
import { releaseRenderer, retainRenderer } from "./weight/three/stage";

/** Short names for the station stills. Cable stays the clip, not a thumbnail. */
export const STATION_LABEL: Partial<Record<GymMachineId, string>> = {
  "chest-press": "Chest press",
  "pec-deck": "Pec deck",
  "seated-dip": "Dip",
  "lat-pulldown": "Pulldown",
  "seated-row": "Row",
  "t-bar-row": "T-bar",
  "lateral-raise": "Lateral",
  preacher: "Preacher",
  "leg-extension": "Extension",
  "leg-curl": "Leg curl",
  "leg-press": "Leg press",
  "calf-raise": "Calf",
  "inner-thigh": "Inner thigh",
  "outer-thigh": "Outer thigh",
};

const COLS = 4;

interface MachineStationPickerProps {
  muscle?: string;
  /** Overrides the muscle list. Used when the lift names a different region. */
  stations?: GymMachineId[];
  value: GymMachineId | null;
  onChange: (id: GymMachineId) => void;
}

export function MachineStationPicker({
  muscle = "",
  stations,
  value,
  onChange,
}: MachineStationPickerProps) {
  useEffect(() => {
    retainRenderer();
    return () => releaseRenderer();
  }, []);

  const choices = (stations ?? stationsForMuscle(muscle)).flatMap((id) => {
    const label = STATION_LABEL[id];
    return label ? [{ id, label }] : [];
  });

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = choices.findIndex((choice) => choice.id === value);
    const index = current < 0 ? 0 : current;
    let next = index;
    if (event.key === "ArrowRight") next = Math.min(choices.length - 1, index + 1);
    else if (event.key === "ArrowLeft") next = Math.max(0, index - 1);
    else if (event.key === "ArrowDown") next = Math.min(choices.length - 1, index + COLS);
    else if (event.key === "ArrowUp") next = Math.max(0, index - COLS);
    else return;
    event.preventDefault();
    const choice = choices[next];
    if (choice) onChange(choice.id);
  };

  if (choices.length === 0) return null;

  return (
    <div
      role="radiogroup"
      aria-label="Station"
      className="grid grid-cols-4 gap-1.5"
      onKeyDown={onKeyDown}
    >
      {choices.map((choice) => {
        const selected = choice.id === value;
        return (
          <button
            key={choice.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(choice.id)}
            className={[
              "flex w-full flex-col items-center justify-center gap-1 rounded-md px-0.5 py-1.5 text-center",
              "text-[11px] leading-tight",
              selected ? "bg-wash-strong text-ink" : "text-muted hover:bg-wash hover:text-ink",
            ].join(" ")}
          >
            <MachineThumb id={choice.id} />
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}
