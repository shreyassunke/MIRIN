/**
 * Isolated harness for the loaded-bar pose. Dev server only — it is not an
 * input to `vite build`. Drives LoadedBar3D at an exact pixel width so the
 * pose can be screenshotted and flip-tested without the rest of the app.
 *
 *   /dev/barbell.html?w=380&plates=45,45,25,10&unit=lb
 */
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "../src/index.css";
import { LoadedBar3D } from "../src/components/weight/three/LoadedBar3D";
import { Dumbbell3D } from "../src/components/weight/three/Dumbbell3D";
import { PlateRack } from "../src/components/weight/PlateRack";
import type { Unit } from "../src/lib/units";

function Harness() {
  const params = new URLSearchParams(location.search);
  const width = Number(params.get("w") ?? 380);
  const unit = (params.get("unit") ?? "lb") as Unit;
  const what = params.get("what") ?? "bar";
  const initial = (params.get("plates") ?? "45,45,45,45")
    .split(",")
    .filter(Boolean)
    .map(Number);
  const [plates, setPlates] = useState(initial);

  useEffect(() => {
    // Let the settle animation finish, then flag the frame as stable.
    const id = window.setTimeout(() => {
      document.body.dataset.ready = "1";
    }, 1200);
    return () => window.clearTimeout(id);
  }, [plates]);

  return (
    <div id="stage" style={{ width }}>
      {what === "dumbbell" && <Dumbbell3D unit={unit} value={plates[0] ?? 30} />}
      {what === "rack" && (
        <PlateRack unit={unit} counts={new Map()} onAdd={() => {}} />
      )}
      {what === "bar" && (
        <LoadedBar3D
          unit={unit}
          plates={plates}
          onRemove={(i) => setPlates((p) => p.filter((_, j) => j !== i))}
        />
      )}
    </div>
  );
}

// No StrictMode: the renderer is a refcounted singleton and the double
// mount would churn the canvas for no benefit in a capture harness.
createRoot(document.getElementById("root")!).render(<Harness />);
