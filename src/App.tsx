import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { AppShell } from "@/components/layout/AppShell";
import { Protected, PublicOnly } from "@/components/layout/RouteGuard";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { GroupsPage } from "@/pages/GroupsPage";
import { GroupDetailPage } from "@/pages/GroupDetailPage";
import { GoalCreatePage } from "@/pages/GoalCreatePage";
import { GoalDetailPage } from "@/pages/GoalDetailPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { NotFoundPage } from "@/pages/NotFoundPage";

const base = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter basename={base}>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnly>
                <LoginPage />
              </PublicOnly>
            }
          />
          <Route
            path="/register"
            element={
              <PublicOnly>
                <RegisterPage />
              </PublicOnly>
            }
          />
          <Route
            element={
              <Protected>
                <AppShell />
              </Protected>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="groups" element={<GroupsPage />} />
            <Route path="groups/:groupId" element={<GroupDetailPage />} />
            <Route path="groups/:groupId/goals/new" element={<GoalCreatePage />} />
            <Route path="goals/:goalId" element={<GoalDetailPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
      <Toaster
        position="top-center"
        richColors
        toastOptions={{
          className:
            "parchment medieval-border font-display tracking-wide",
        }}
      />
    </ThemeProvider>
  );
}
