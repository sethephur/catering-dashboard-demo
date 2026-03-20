import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { useAuth } from "../auth/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { Badge } from "../components/ui/badge";
import AppFooter from "../components/AppFooter";
import { APP_DISPLAY_NAME, DEMO_MODE_ENABLED } from "@/config/appInfo";

const toTitleCase = (value: string) =>
  value
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const getWelcomeName = (displayName: string | null, email: string | null) => {
  const trimmedDisplayName = displayName?.trim();
  if (trimmedDisplayName) {
    return trimmedDisplayName.split(/\s+/)[0];
  }

  const emailLocalPart = email?.split("@")[0]?.trim();
  if (emailLocalPart) {
    return toTitleCase(emailLocalPart.split(/[._-]+/)[0] || emailLocalPart);
  }

  return "back";
};

const getAuthErrorMessage = (error: unknown) => {
  if (typeof error !== "object" || error == null || !("code" in error)) {
    return DEMO_MODE_ENABLED
      ? "Demo sign-in failed."
      : "Login failed. Check your credentials and Firebase Auth setup.";
  }

  const code = String((error as { code?: unknown }).code);

  switch (code) {
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Try again later or reset the password.";
    default:
      return DEMO_MODE_ENABLED
        ? "Demo sign-in failed."
        : "Login failed. Check your credentials and Firebase Auth setup.";
  }
};

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const { settings } = useSiteSettings();
  const { isAuthenticated, isLoading, login, resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo =
    ((location.state as { from?: { pathname?: string } } | null)?.from
      ?.pathname as string | undefined) || "/dashboard";

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, redirectTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const signedInUser = await login(email, password);
      if (
        settings.enableDesktopNotifications &&
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "default"
      ) {
        try {
          const permission = await Notification.requestPermission();
          if (permission === "granted") {
            toast.success("Desktop notifications enabled.");
          } else if (permission === "denied") {
            toast.error("Desktop notifications were blocked by the browser.");
          }
        } catch (error) {
          console.error("Failed to request notification permission:", error);
          toast.error("Could not enable desktop notifications.");
        }
      }
      toast.success(`Welcome ${getWelcomeName(signedInUser.displayName, signedInUser.email)}!`);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      console.error("Login threw an error:", err);
      toast.error(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      toast.error("Enter your email address first.");
      return;
    }

    setResettingPassword(true);

    try {
      await resetPassword(email);
      toast.success(
        DEMO_MODE_ENABLED
          ? "Demo mode does not send email. Use any password to enter the workspace."
          : "Password reset email sent.",
      );
    } catch (error) {
      console.error("Password reset failed:", error);
      toast.error(getAuthErrorMessage(error));
    } finally {
      setResettingPassword(false);
    }
  };

  const handleDemoEntry = async () => {
    setLoading(true);

    try {
      const signedInUser = await login(email || "demo.admin@example.com", password || "demo-access");
      toast.success(
        `Welcome ${getWelcomeName(signedInUser.displayName, signedInUser.email)}!`,
      );
      navigate(redirectTo, { replace: true });
    } catch (error) {
      console.error("Demo login failed:", error);
      toast.error(getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-sidebar px-4 py-10 text-foreground sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl flex-col justify-center gap-10">
        <div className="grid w-full gap-10 lg:grid-cols-[1.1fr_420px] lg:items-center">
          <section className="min-w-0 space-y-6">
            <div className="space-y-4">
              <Badge variant="secondary">Workspace Access</Badge>
              <div className="space-y-3">
                <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                  {APP_DISPLAY_NAME}
                </h1>
                <p className="max-w-lg text-base leading-7 text-muted-foreground">
                  Review live inquiries, manage client relationships, create
                  events, and keep the catering pipeline moving from one
                  dashboard.
                </p>
                {DEMO_MODE_ENABLED && (
                  <p className="max-w-lg text-sm leading-6 text-muted-foreground">
                    Demo mode is enabled. The app uses synthetic workspace data and
                    local-only sign-in.
                  </p>
                )}
              </div>
            </div>

          </section>

          <Card className="w-full border-border/70 bg-card/95 shadow-sm">
            <CardHeader className="space-y-2">
              <CardTitle>
                {DEMO_MODE_ENABLED ? "Enter the demo workspace" : "Login to continue"}
              </CardTitle>
              <CardDescription>
                {DEMO_MODE_ENABLED
                  ? "Use any email and password, or jump in with the demo account."
                  : "Sign in with your authorized workspace email and password."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-6"
                autoComplete="on"
              >
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder={
                      DEMO_MODE_ENABLED ? "demo.admin@example.com" : "you@company.com"
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder={
                      DEMO_MODE_ENABLED ? "Any password works in demo mode" : "Enter password"
                    }
                  />
                </div>
                <Button type="submit" disabled={loading || isLoading}>
                  {loading ? "Checking..." : DEMO_MODE_ENABLED ? "Continue" : "Login"}
                </Button>
                {DEMO_MODE_ENABLED && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDemoEntry}
                    disabled={loading || isLoading}
                  >
                    Enter demo as admin
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleResetPassword}
                  disabled={resettingPassword || loading || isLoading}
                >
                  {resettingPassword
                    ? "Sending reset..."
                    : DEMO_MODE_ENABLED
                      ? "Need demo access?"
                      : "Forgot password?"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
        <AppFooter />
      </div>
    </div>
  );
}
