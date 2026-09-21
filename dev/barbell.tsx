/**
 * Isolated harness for the loaded-bar pose. Dev server only — it is not an
 * input to `vite build`. Drives LoadedBar3D at an exact pixel width so the
 * pose can be screenshotted and flip-tested without the rest of the app.
 *
 *   /dev/barbell.html?w=380&plates=45,45,25,10&unit=lb
 */
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "../src/index.css";
import { LoadedBar3D } from "../src/components/weight/three/LoadedBar3D";
import { Dumbbell3D } from "../src/components/weight/three/Dumbbell3D";
import { PlateRack } from "../src/components/weight/PlateRack";
import {
  BarbellPicker,
  BarbellRack,
  BarWeightControl,
} from "../src/components/weight/BarbellPicker";
import { DumbbellPicker } from "../src/components/weight/DumbbellPicker";
import { LoadInstrument } from "../src/components/weight/LoadInstrument";
import { Stepper } from "../src/components/Stepper";
import type { InputMethod, Unit } from "../src/lib/units";

function PagerHarness({ unit }: { unit: Unit }) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<InputMethod>("barbell");
  const [plates, setPlates] = useState<number[]>([]);
  const [barWeight, setBarWeight] = useState(unit === "lb" ? 45 : 20);
  const [dumbbell, setDumbbell] = useState(30);
  const [manual, setManual] = useState(unit === "lb" ? 45 : 20);
  const modes = [
    { id: "barbell" as const, label: "Barbell" },
    { id: "dumbbell" as const, label: "Dumbbell" },
    { id: "manual" as const, label: "Type weight" },
  ];
  return (
    <div ref={fieldRef} className="load-swipe-field bg-bg px-4 py-6 text-ink">
      <p className="mb-8 text-center text-lg font-semibold tracking-tight">
        Incline Press
      </p>
      <LoadInstrument
        unit={unit}
        ghost={45}
        modes={modes}
        mode={mode}
        onModeChange={setMode}
        fieldRef={fieldRef}
        pages={modes.map((m) => {
          if (m.id === "barbell") {
            return {
              id: m.id,
              label: m.label,
              weight: barWeight,
              weightDisplay: (
                <BarWeightControl
                  unit={unit}
                  barWeight={barWeight}
                  plates={plates}
                  onChange={(bar, next) => {
                    setBarWeight(bar);
                    setPlates(next);
                  }}
                />
              ),
              stage: (
                <BarbellPicker
                  unit={unit}
                  barWeight={barWeight}
                  plates={plates}
                  live={mode === "barbell"}
                  onChange={(bar, next) => {
                    setBarWeight(bar);
                    setPlates(next);
                  }}
                />
              ),
              extras: (
                <BarbellRack
                  unit={unit}
                  barWeight={barWeight}
                  plates={plates}
                  onChange={(bar, next) => {
                    setBarWeight(bar);
                    setPlates(next);
                  }}
                />
              ),
            };
          }
          if (m.id === "dumbbell") {
            return {
              id: m.id,
              label: m.label,
              weight: dumbbell,
              stage: (
                <DumbbellPicker
                  unit={unit}
                  value={dumbbell}
                  laterality="bilateral"
                  live={mode === "dumbbell"}
                  onChange={setDumbbell}
                  onToggleLaterality={() => {}}
                />
              ),
            };
          }
          return {
            id: m.id,
            label: m.label,
            weight: manual,
            extras: (
              <div className="flex flex-col items-center">
                <Stepper
                  label={`Weight (${unit})`}
                  value={manual}
                  step={5}
                  onChange={setManual}
                />
              </div>
            ),
          };
        })}
      />
      <div className="mt-8 text-center text-sm text-muted">Reps</div>
      <p className="mt-10 text-center text-[13px] text-muted">
        Swipe anywhere on this card
      </p>
    </div>
  );
}

function Harness() {
  const params = new URLSearchParams(location.search);
  const width = Number(params.get("w") ?? 380);
  const unit = (params.get("unit") ?? "lb") as Unit;
  const what = params.get("what") ?? "bar";
  const pair = params.get("pair") === "1";
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
      {what === "dumbbell" && (
        <Dumbbell3D unit={unit} value={plates[0] ?? 30} pair={pair} />
      )}
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
      {what === "pager" && <PagerHarness unit={unit} />}
    </div>
  );
}

// No StrictMode: the renderer is a refcounted singleton and the double
// mount would churn the canvas for no benefit in a capture harness.
createRoot(document.getElementById("root")!).render(<Harness />);
