import { lazy, Suspense, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppIntro } from "./components/AppIntro";
import { prefetchIntroVideo, shouldShowIntro } from "./lib/introVideo";
import { AppShell } from "./components/AppShell";
import { Today } from "./screens/Today";

// The core loop loads eagerly; everything else (including Recharts)
// splits out of the main bundle.
const ExerciseDetail = lazy(() =>
  import("./screens/ExerciseDetail").then((m) => ({
    default: m.ExerciseDetail,
  })),
);
const Trends = lazy(() =>
  import("./screens/Trends").then((m) => ({ default: m.Trends })),
);
const SplitEditor = lazy(() =>
  import("./screens/SplitEditor").then((m) => ({ default: m.SplitEditor })),
);

if (shouldShowIntro()) {
  prefetchIntroVideo();
}

export default function App() {
  const [introComplete, setIntroComplete] = useState(() => !shouldShowIntro());

  if (!introComplete) {
    return <AppIntro onComplete={() => setIntroComplete(true)} />;
  }

  return (
    <AppShell>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <Routes>
          <Route path="/" element={<Navigate to="/today" replace />} />
          <Route path="/today" element={<Today />} />
          <Route path="/exercise/:id" element={<ExerciseDetail />} />
          <Route path="/progress" element={<Trends />} />
          <Route path="/split" element={<SplitEditor />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
