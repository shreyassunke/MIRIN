import { lazy, Suspense, useCallback, useState } from "react";
import { ChunkErrorBoundary, hasWebGL } from "../weight/three/fallback";
import type { Gender } from "../../lib/body";
import { GENDER_KEY, useSettingValue } from "../../lib/profile";
import type { RegionId } from "../../lib/muscleRegions";
import { PHYSIQUE_STAGE_CLASS } from "./constants";
import { PhysiqueFallback } from "./PhysiqueFallback";

const loadCanvas = () =>
  import("./PhysiqueCanvas").then((m) => ({ default: m.PhysiqueCanvas }));
const PhysiqueCanvas = lazy(loadCanvas);
void loadCanvas();

function StagePlaceholder() {
  return (
    <div
      className={`${PHYSIQUE_STAGE_CLASS} flex items-center justify-center text-[13px] text-muted`}
    >
      Loading figure…
    </div>
  );
}

export function Physique({
  intensities,
  selected,
  onSelect,
}: {
  intensities: Record<RegionId, number>;
  selected: RegionId | null;
  onSelect: (id: RegionId | null) => void;
}) {
  const [failed, setFailed] = useState(false);
  const onError = useCallback(() => setFailed(true), []);
  const genderRaw = useSettingValue(GENDER_KEY);
  const gender: Gender = genderRaw === "female" ? "female" : "male";

  if (genderRaw === null) {
    return <StagePlaceholder />;
  }

  if (!hasWebGL() || failed) {
    return (
      <PhysiqueFallback
        intensities={intensities}
        selected={selected}
        onSelect={onSelect}
      />
    );
  }

  return (
    <ChunkErrorBoundary
      fallback={
        <PhysiqueFallback
          intensities={intensities}
          selected={selected}
          onSelect={onSelect}
        />
      }
    >
      <Suspense fallback={<StagePlaceholder />}>
        <PhysiqueCanvas
          key={gender}
          gender={gender}
          selected={selected}
          onSelect={onSelect}
          onError={onError}
        />
      </Suspense>
    </ChunkErrorBoundary>
  );
}
