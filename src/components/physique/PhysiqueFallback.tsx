import { REGION_IDS, REGION_LABEL, type RegionId } from "../../lib/muscleRegions";

export function PhysiqueFallback({
  intensities,
  selected,
  onSelect,
}: {
  intensities: Record<RegionId, number>;
  selected: RegionId | null;
  onSelect: (id: RegionId | null) => void;
}) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {REGION_IDS.map((id) => {
        const active = id === selected;
        const trained = intensities[id] > 0;
        return (
          <li key={id}>
            <button
              type="button"
              onClick={() => onSelect(id)}
              className={[
                "h-11 w-full rounded-md border px-3 text-left text-[13px] font-medium transition-colors duration-150",
                active
                  ? "border-ink bg-surface text-ink"
                  : "border-hairline bg-surface text-muted hover:text-ink",
              ].join(" ")}
            >
              {REGION_LABEL[id]}
              <span className="ml-2 tnum text-[11px] text-muted">
                {trained ? Math.round(intensities[id] * 100) : "—"}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
