// Type declaration for the vendored exercise library (requires
// `allowArbitraryExtensions`). Shape matches ExerciseLibraryEntry.
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
