export type LiftPose =
  | "press"
  | "incline"
  | "decline"
  | "overhead"
  | "curl"
  | "row"
  | "pulldown"
  | "fly"
  | "raise"
  | "squat"
  | "hinge"
  | "lunge"
  | "extension"
  | "shrug"
  | "calf"
  | "core";

export type Implement =
  | "dumbbell"
  | "barbell"
  | "cable"
  | "kettlebell"
  | "machine"
  | "body";

export interface LiftMarkSpec {
  pose: LiftPose;
  implement: Implement;
}

function implementOf(name: string, equipment: string | undefined): Implement {
  const n = name.toLowerCase();
  if (/\bdumbbells?\b|\bdbs?\b/.test(n)) return "dumbbell";
  if (/\bkettlebells?\b|\bkbs?\b/.test(n)) return "kettlebell";
  if (/\bcables?\b/.test(n)) return "cable";
  if (/\bbarbells?\b|\bbs?\b|\bsmith\b/.test(n)) return "barbell";
  const equip = (equipment ?? "").toLowerCase();
  if (equip.includes("dumbbell")) return "dumbbell";
  if (equip.includes("kettle")) return "kettlebell";
  if (equip.includes("cable")) return "cable";
  if (equip.includes("barbell") || equip.includes("smith")) return "barbell";
  if (equip.includes("body")) return "body";
  if (
    equip.includes("machine") ||
    /pull-up|pullup|chin-up|chinup|push-up|pushup|\bdips?\b/.test(n)
  ) {
    return /pull-up|pullup|chin-up|chinup|push-up|pushup|\bdips?\b/.test(n)
      ? "body"
      : "machine";
  }
  if (equip.length > 0) return "machine";
  return "barbell";
}

function poseOf(name: string): LiftPose {
  const n = name.toLowerCase();
  if (/face pull|rear delt/.test(n)) return "raise";
  if (/\bflye?s?\b|crossover/.test(n)) return "fly";
  if (/curl/.test(n)) return "curl";
  if (/pulldown|pull-up|pullup|chin-up|chinup|lat pull/.test(n)) return "pulldown";
  if (/lateral|side raise|front raise|\braise\b/.test(n)) return "raise";
  if (/row/.test(n)) return "row";
  if (/squat/.test(n)) return "squat";
  if (/lunge|split squat/.test(n)) return "lunge";
  if (/deadlift|\brdl\b|romanian|good morning|hip hinge|\bthrust\b/.test(n)) {
    return "hinge";
  }
  if (/shrug/.test(n)) return "shrug";
  if (/calf/.test(n)) return "calf";
  if (/crunch|sit-up|situp|plank|leg raise/.test(n)) return "core";
  if (/extension|pushdown|push-down|skull|kickback/.test(n)) return "extension";
  if (/incline/.test(n)) return "incline";
  if (/decline/.test(n)) return "decline";
  if (/overhead|\bohp\b|shoulder press|military|arnold/.test(n)) return "overhead";
  return "press";
}

/** Movement engraving for a goal: the implement, posed like the lift. */
export function liftMark(name: string, equipment?: string): LiftMarkSpec {
  return { pose: poseOf(name), implement: implementOf(name, equipment) };
}
