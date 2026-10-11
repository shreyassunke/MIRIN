import { useEffect, useRef, useState } from "react";
import type { GymMachineId } from "../lib/library";
import { hasWebGL } from "./weight/three/fallback";
import { machineThumb } from "./weight/three/machineThumb";
import { MachineMark } from "./machineMarks";

export function MachineThumb({ id }: { id: GymMachineId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!hasWebGL()) return;
    let cancelled = false;
    machineThumb(id)
      .then((src) => {
        const dest = ref.current;
        if (cancelled || !dest) return;
        dest.width = src.width;
        dest.height = src.height;
        const ctx = dest.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(src, 0, 0);
        setReady(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!hasWebGL()) return <MachineMark id={id} />;

  return (
    <canvas
      ref={ref}
      data-station-thumb={id}
      data-ready={ready ? "1" : "0"}
      className={`h-16 w-16 ${ready ? "" : "opacity-0"}`}
      aria-hidden="true"
    />
  );
}
