import type { GymMachineId } from "../../lib/library";

export const GYM_MACHINE_STAGE: Record<GymMachineId, string> = {
  "lat-pulldown": "mx-auto h-64 w-full max-w-sm",
  cable: "mx-auto h-44 w-full",
  "leg-curl": "mx-auto h-56 w-full max-w-sm",
  "pec-deck": "mx-auto h-64 w-full max-w-sm",
};

export const GYM_MACHINE_URL: Record<GymMachineId, string> = {
  "lat-pulldown": "/models/lat-pulldown.glb",
  cable: "/models/cable-crossover.glb",
  "leg-curl": "/models/lying-leg-curl.glb",
  "pec-deck": "/models/pec-deck.glb",
};

export const GYM_MACHINE_LABEL: Record<GymMachineId, string> = {
  "lat-pulldown": "Lat pulldown machine",
  cable: "Cable machine",
  "leg-curl": "Lying leg curl",
  "pec-deck": "Pec deck",
};
