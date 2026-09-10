// Type declaration for the curated form-video map (requires
// `allowArbitraryExtensions`). Keyed by exercise library id; the shape must
// stay in sync with FormClip in lib/formVideos.ts, which is what consumers
// import. Contents are validated at build time by
// `npm run verify:form-videos` — TypeScript cannot check a JSON file against
// this declaration.
declare const clips: Record<
  string,
  {
    videoId: string;
    creator: "nippard" | "athleanx" | "plitt";
    label?: string;
    start?: number;
    end?: number;
  }[]
>;
export default clips;
