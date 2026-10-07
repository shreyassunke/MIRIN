import { gymMachineFor } from "./library";

/**
 * The five pieces in a standard cable clip set. Proportions follow the
 * reference photo plus published hardware: Goplus straight bar 45 cm × 25 mm,
 * double-D handle 18.5 × 17.5 × 12 cm, rope 69 cm; FGO stirrup about
 * 18 × 12 cm and V-bar grip Ø 28 mm; York commercial grip Ø 35 mm. The photo's
 * molded grips sit between those, near 32 mm.
 */
export const CABLE_ATTACHMENTS = [
  { id: "straight", label: "Straight" },
  { id: "ez", label: "EZ bar" },
  { id: "close", label: "Close grip" },
  { id: "rope", label: "Rope" },
  { id: "stirrup", label: "Stirrup" },
] as const;

export type CableAttachmentId = (typeof CABLE_ATTACHMENTS)[number]["id"];

export function isCableAttachmentId(value: string): value is CableAttachmentId {
  return CABLE_ATTACHMENTS.some((item) => item.id === value);
}

export function cableAttachmentLabel(id: CableAttachmentId) {
  return CABLE_ATTACHMENTS.find((item) => item.id === id)?.label ?? id;
}

/** Lat pulldown, seated row, and every other cable exercise. */
export function isCableStation(exercise: {
  id: string;
  name: string;
  equipment?: string;
  isCustom?: boolean;
}) {
  const machine = gymMachineFor(exercise);
  return (
    machine === "lat-pulldown" || machine === "seated-row" || machine === "cable"
  );
}

/**
 * What most lifters clip on for this movement, before a saved choice.
 * One-arm work wins over the two-hand default of the same pattern.
 */
export function defaultCableAttachment(exercise: {
  id: string;
  name: string;
}): CableAttachmentId {
  const blob = `${exercise.id} ${exercise.name}`.toLowerCase();
  if (/\b(one[- ]arm|single[- ]arm)\b/.test(blob)) return "stirrup";
  if (/\brope\b/.test(blob)) return "rope";
  if (/\bface[- ]?pulls?\b/.test(blob)) return "rope";
  if (/\b(push-?downs?|press-?downs?|kickbacks?)\b/.test(blob)) return "rope";
  if (/\bcurls?\b/.test(blob)) return "ez";
  if (/\b(close[- ]?grip|v[- ]?bars?)\b/.test(blob)) return "close";
  if (
    /\b(flye?s?|crossovers?|laterals?|raises?|rotations?|adductions?|crunches?|twists?)\b/.test(
      blob,
    )
  ) {
    return "stirrup";
  }
  if (
    exercise.id === "cable-row" ||
    /\bseated (cable )?rows?\b/i.test(exercise.name) ||
    /\brows?\b/.test(blob)
  ) {
    return "close";
  }
  if (/\b(pull-?downs?|pulldowns?)\b/.test(blob)) return "straight";
  if (/\b(press(?:es)?|shrugs?|deadlifts?)\b/.test(blob)) return "straight";
  return "stirrup";
}

export function resolveCableAttachment(
  exercise: { id: string; name: string },
  preferred?: string,
): CableAttachmentId {
  if (preferred && isCableAttachmentId(preferred)) return preferred;
  return defaultCableAttachment(exercise);
}
