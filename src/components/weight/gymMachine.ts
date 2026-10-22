import type { GymMachineId } from "../../lib/library";

/** Same resting height as the bar. The number sits on it; Log sits under it. */
const STAGE = "weight-stage weight-stage-machine";

export const GYM_MACHINE_STAGE: Record<GymMachineId, string> = {
  "lat-pulldown": STAGE,
  cable: STAGE,
  "seated-row": STAGE,
  "leg-curl": STAGE,
  "pec-deck": STAGE,
  "leg-press": STAGE,
  "calf-raise": STAGE,
  "t-bar-row": STAGE,
  "leg-extension": STAGE,
  "inner-thigh": STAGE,
  "outer-thigh": STAGE,
  preacher: STAGE,
  "seated-dip": STAGE,
  "lateral-raise": STAGE,
  "chest-press": STAGE,
  "shoulder-press": STAGE,
};

export const GYM_MACHINE_URL: Record<GymMachineId, string> = {
  "lat-pulldown": "/models/lat-pulldown.glb",
  cable: "/models/cable-crossover.glb",
  "seated-row": "/models/seated-cable-row.glb",
  "leg-curl": "/models/lying-leg-curl.glb",
  "pec-deck": "/models/pec-deck.glb",
  "leg-press": "/models/leg-press.glb",
  "calf-raise": "/models/standing-calf-raise.glb",
  "t-bar-row": "/models/t-bar-row.glb",
  "leg-extension": "/models/leg-extension.glb",
  "inner-thigh": "/models/inner-thigh.glb",
  "outer-thigh": "/models/outer-thigh.glb",
  preacher: "/models/preacher-curl.glb",
  "seated-dip": "/models/seated-dip.glb",
  "lateral-raise": "/models/lateral-raise.glb",
  "chest-press": "",
  "shoulder-press": "",
};

export const GYM_MACHINE_LABEL: Record<GymMachineId, string> = {
  "lat-pulldown": "Lat pulldown machine",
  cable: "Cable machine",
  "seated-row": "Seated cable row",
  "leg-curl": "Lying leg curl",
  "pec-deck": "Pec deck",
  "leg-press": "Leg press",
  "calf-raise": "Standing calf raise",
  "t-bar-row": "T-bar row",
  "leg-extension": "Leg extension",
  "inner-thigh": "Inner thigh",
  "outer-thigh": "Outer thigh",
  preacher: "Preacher curl",
  "seated-dip": "Seated dip",
  "lateral-raise": "Lateral raise",
  "chest-press": "Plate-loaded chest press",
  "shoulder-press": "Shoulder press",
};
