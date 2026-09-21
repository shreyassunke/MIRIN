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
import { exerciseLabelForMethod } from "../src/lib/library";
import {
  lateralityCaption,
  type Laterality,
} from "../src/lib/laterality";

function PagerHarness({
  unit,
  startMode = "barbell",
  startLaterality = "bilateral",
}: {
  unit: Unit;
  startMode?: InputMethod;
  startLaterality?: Laterality;
}) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<InputMethod>(startMode);
  const [plates, setPlates] = useState<number[]>([]);
  const [barWeight, setBarWeight] = useState(unit === "lb" ? 45 : 20);
  const [dumbbell, setDumbbell] = useState(30);
  const [laterality, setLaterality] = useState<Laterality>(startLaterality);
  const [manual, setManual] = useState(unit === "lb" ? 45 : 20);
  const modes = [
    { id: "barbell" as const, label: "Barbell" },
    { id: "dumbbell" as const, label: "Dumbbell" },
    { id: "manual" as const, label: "Type weight" },
  ];
  const [reps, setReps] = useState(8);
  return (
    <div ref={fieldRef} className="load-swipe-field bg-bg px-4 py-6 text-ink">
      <p className="mb-4 text-lg font-semibold tracking-tight">
        {exerciseLabelForMethod("Incline Barbell Press", mode)}
      </p>
      <div className="flex flex-col gap-4">
      <LoadInstrument
        unit={unit}
        modes={modes}
        mode={mode}
        onModeChange={setMode}
        fieldRef={fieldRef}
        footer={
          <Stepper
            label="Reps"
            value={reps}
            step={1}
            min={1}
            layout="inline"
            inlineSuffix="reps"
            size="compact"
            onChange={setReps}
          />
        }
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
              qualifier:
                laterality === "bilateral"
                  ? lateralityCaption(laterality, "independent")
                  : undefined,
              stage: (
                <DumbbellPicker
                  unit={unit}
                  value={dumbbell}
                  laterality={laterality}
                  live={mode === "dumbbell"}
                  onChange={setDumbbell}
                  onToggleLaterality={() =>
                    setLaterality((current) =>
                      current === "bilateral" ? "unilateral" : "bilateral",
                    )
                  }
                />
              ),
            };
          }
          return {
            id: m.id,
            label: m.label,
            weight: manual,
            weightDisplay: (
              <Stepper
                label={`Weight (${unit})`}
                value={manual}
                step={5}
                min={0}
                layout="stacked"
                inlineSuffix={unit}
                size="lead"
                onChange={setManual}
              />
            ),
          };
        })}
      />
      <button
        type="button"
        data-no-pager=""
        className="btn-primary h-12 w-full rounded-pill bg-accent text-[15px] font-semibold text-bg"
      >
        Log set
      </button>
      </div>
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
      {what === "pager" && (
        <PagerHarness
          unit={unit}
          startMode={(params.get("mode") as InputMethod | null) ?? undefined}
          startLaterality={
            params.get("pair") === "0" ? "unilateral" : "bilateral"
          }
        />
      )}
    </div>
  );
}

// No StrictMode: the renderer is a refcounted singleton and the double
// mount would churn the canvas for no benefit in a capture harness.
createRoot(document.getElementById("root")!).render(<Harness />);
