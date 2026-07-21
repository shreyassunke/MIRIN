import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth/RequireAuth";
import { AppShell } from "./components/AppShell";
import { Auth } from "./screens/Auth";
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
const Profile = lazy(() =>
  import("./screens/Profile").then((m) => ({ default: m.Profile })),
);

function ProtectedLayout() {
  return (
    <RequireAuth>
      <AppShell>
        <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
          <Outlet />
        </Suspense>
      </AppShell>
    </RequireAuth>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<Navigate to="/today" replace />} />
        <Route path="/today" element={<Today />} />
        <Route path="/exercise/:id" element={<ExerciseDetail />} />
        <Route path="/progress" element={<Trends />} />
        <Route path="/split" element={<SplitEditor />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/today" replace />} />
    </Routes>
  );
}
