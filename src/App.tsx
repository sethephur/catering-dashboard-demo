import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import AppLayout from "./layout/AppLayout";
import Login from "./pages/Login";
import Inquiries from "./pages/Inquiries";
import Clients from "./pages/Clients";
import Events from "./pages/Events";
import ClientDashboard from "./pages/ClientDashboard";
import CalendarPage from "./pages/CalendarPage";
import Account from "./pages/Account";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import HelpPage from "./pages/HelpPage";
import Support from "./pages/Support";
import { NewEventDialogProvider } from "@/providers/new-event-dialog";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/auth/AuthContext";

function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Checking session</CardTitle>
          <CardDescription>
            Confirming your workspace authentication status.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}

function SupportRoute() {
  const { isAdmin, isAdminLoading } = useAuth();

  if (isAdminLoading) {
    return (
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Checking permissions</CardTitle>
          <CardDescription>
            Confirming whether this account can access support.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Support />;
}

function App() {
  return (
    <NewEventDialogProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/help" element={<HelpPage />} />

        {/* Everything under / is protected */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Inquiries />} />
            <Route path="/inquiries" element={<Navigate to="/dashboard" replace />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/events" element={<Events />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/account" element={<Account />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/support" element={<SupportRoute />} />
            <Route path="/clients/:clientId" element={<ClientDashboard />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </NewEventDialogProvider>
  );
}

export default App;
