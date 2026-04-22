import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/store/auth";

export function Protected({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const location = useLocation();
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

export function PublicOnly({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  if (session) return <Navigate to="/" replace />;
  return <>{children}</>;
}
