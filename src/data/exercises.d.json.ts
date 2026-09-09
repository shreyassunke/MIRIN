// Type declaration for the vendored exercise library (requires
// `allowArbitraryExtensions`). Attachment type is derived from equipment
// in library.ts and is not stored in this file.
declare const entries: {
  id: string;
  name: string;
  aliases: string[];
  category: string;
  equipment: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  inputMethodHint: "barbell" | "dumbbell" | "manual";
}[];
export default entries;
