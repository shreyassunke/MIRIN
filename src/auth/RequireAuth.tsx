import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { configured, loading, session } = useAuth();
  const location = useLocation();

  if (loading) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  if (!configured || !session) {
    return (
      <Navigate to="/auth" replace state={{ from: location.pathname }} />
    );
  }

  return children;
}
