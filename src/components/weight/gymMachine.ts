import type { GymMachineId } from "../../lib/library";

export const GYM_MACHINE_STAGE: Record<GymMachineId, string> = {
  "lat-pulldown": "mx-auto h-64 w-full max-w-sm",
  cable: "mx-auto h-44 w-full",
  "seated-row": "mx-auto h-56 w-full max-w-sm",
  "leg-curl": "mx-auto h-56 w-full max-w-sm",
  "pec-deck": "mx-auto h-64 w-full max-w-sm",
  "leg-press": "mx-auto h-56 w-full max-w-sm",
  "calf-raise": "mx-auto h-64 w-full max-w-sm",
};

export const GYM_MACHINE_URL: Record<GymMachineId, string> = {
  "lat-pulldown": "/models/lat-pulldown.glb",
  cable: "/models/cable-crossover.glb",
  "seated-row": "/models/seated-cable-row.glb",
  "leg-curl": "/models/lying-leg-curl.glb",
  "pec-deck": "/models/pec-deck.glb",
  "leg-press": "/models/leg-press.glb",
  "calf-raise": "/models/standing-calf-raise.glb",
};

export const GYM_MACHINE_LABEL: Record<GymMachineId, string> = {
  "lat-pulldown": "Lat pulldown machine",
  cable: "Cable machine",
  "seated-row": "Seated cable row",
  "leg-curl": "Lying leg curl",
  "pec-deck": "Pec deck",
  "leg-press": "Leg press",
  "calf-raise": "Standing calf raise",
};
