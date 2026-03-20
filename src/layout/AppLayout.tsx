import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import AppFooter from "@/components/AppFooter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const SESSION_THEME_OVERRIDE_KEY = "session-theme-override";
const DASHBOARD_WELCOME_VERSION = "dashboard-welcome-v1";
const DASHBOARD_WELCOME_STORAGE_KEY = "dashboard-welcome-version";

const dashboardWelcomeSteps = [
  {
    title: "Welcome to the new dashboard",
    description:
      "The inquiries page is now the main dashboard, with the inbox kept front-and-center and the new sidebar handling navigation across clients, events, calendar, and settings.",
  },
  {
    title: "Custom email templates are built in",
    description:
      "You can now create, edit, preview, and save reusable email templates directly inside the workspace, so inquiry follow-up stays faster and more consistent.",
  },
  {
    title: "Dashboard stats are live",
    description:
      "The new dashboard now includes live stats and activity context, making it easier to get a quick read on the state of the inquiry pipeline as soon as you land in the workspace.",
  },
] as const;

function AppLayoutShell() {
  const location = useLocation();
  const currentSectionLabel = useMemo(() => {
    if (location.pathname.startsWith("/clients/")) return "Client";
    if (location.pathname.startsWith("/dashboard")) return "Dashboard";
    if (location.pathname.startsWith("/clients")) return "Clients";
    if (location.pathname.startsWith("/events")) return "Events";
    if (location.pathname.startsWith("/calendar")) return "Calendar";
    if (location.pathname.startsWith("/reports")) return "Reports";
    if (location.pathname.startsWith("/account")) return "Account";
    if (location.pathname.startsWith("/settings")) return "Settings";
    return "Dashboard";
  }, [location.pathname]);

  return (
    <SidebarInset className="overflow-hidden rounded-sm border border-border/70 md:m-2">
      <div className="min-h-screen bg-background text-foreground">
        <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur transition-[width,height] ease-linear">
          <div className="flex w-full items-center gap-2 px-3 lg:px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mx-1 data-[orientation=vertical]:h-4"
            />
            <div className="flex items-center gap-2">
              <h1 className="text-md">{currentSectionLabel}</h1>
            </div>
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          <div className="min-w-0">
            <Outlet />
          </div>
          <AppFooter />
        </main>
      </div>
    </SidebarInset>
  );
}

function DashboardWelcomeFlow() {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const seenVersion = window.localStorage.getItem(
      DASHBOARD_WELCOME_STORAGE_KEY,
    );
    if (seenVersion === DASHBOARD_WELCOME_VERSION) return;

    setOpen(true);
  }, []);

  const finishWelcome = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        DASHBOARD_WELCOME_STORAGE_KEY,
        DASHBOARD_WELCOME_VERSION,
      );
    }
    setOpen(false);
  };

  const currentStep = dashboardWelcomeSteps[stepIndex];
  const isLastStep = stepIndex === dashboardWelcomeSteps.length - 1;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          finishWelcome();
          return;
        }
        setOpen(nextOpen);
      }}
    >
      <AlertDialogContent className="sm:max-w-xl">
        <AlertDialogHeader>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            <Badge variant="secondary">New version</Badge>
            <span>
              {stepIndex + 1} / {dashboardWelcomeSteps.length}
            </span>
          </div>
          <AlertDialogTitle>{currentStep.title}</AlertDialogTitle>
          <AlertDialogDescription className="leading-6">
            {currentStep.description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={finishWelcome}>Skip intro</AlertDialogCancel>
          {stepIndex > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStepIndex((prev) => Math.max(prev - 1, 0))}
            >
              Back
            </Button>
          )}
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();

              if (isLastStep) {
                finishWelcome();
                return;
              }

              setStepIndex((prev) => prev + 1);
            }}
          >
            {isLastStep ? "Open dashboard" : "Next"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function AppLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { settings } = useSiteSettings();
  const didMountRef = useState({ current: false })[0];
  const [sessionThemeOverride, setSessionThemeOverride] = useState<
    "light" | "dark" | null
  >(() => {
    if (typeof window === "undefined") return null;

    const stored = window.sessionStorage.getItem(SESSION_THEME_OVERRIDE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  });

  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
    try {
      return (
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      );
    } catch {
      return false;
    }
  });

  const defaultIsDark =
    settings.defaultTheme === "system"
      ? systemPrefersDark
      : settings.defaultTheme === "dark";
  const isDark =
    sessionThemeOverride === null
      ? defaultIsDark
      : sessionThemeOverride === "dark";

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    setSessionThemeOverride(null);
  }, [didMountRef, settings.defaultTheme]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (sessionThemeOverride === null) {
      window.sessionStorage.removeItem(SESSION_THEME_OVERRIDE_KEY);
      return;
    }

    window.sessionStorage.setItem(
      SESSION_THEME_OVERRIDE_KEY,
      sessionThemeOverride,
    );
  }, [sessionThemeOverride]);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
      return;
    }
    root.classList.remove("dark");
    localStorage.setItem("theme", "light");
  }, [isDark]);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", handler);
    } else {
      mql.addListener(handler);
    }
    return () => {
      if (typeof mql.removeEventListener === "function") {
        mql.removeEventListener("change", handler);
      } else {
        mql.removeListener(handler);
      }
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
      toast.error("Logout failed. Please try again.");
    }
  };

  return (
    <SidebarProvider
      defaultOpen
      className="bg-sidebar"
      style={
        {
          "--sidebar-width": "16rem",
          "--sidebar-width-mobile": "16rem",
          "--header-height": "3.25rem",
        } as CSSProperties
      }
    >
      <AppSidebar
        isDark={isDark}
        onToggleTheme={() =>
          setSessionThemeOverride((prev) => {
            if (prev === null) {
              return defaultIsDark ? "light" : "dark";
            }
            return prev === "dark" ? "light" : "dark";
          })
        }
        onLogout={handleLogout}
      />
      <AppLayoutShell />
      <DashboardWelcomeFlow />
    </SidebarProvider>
  );
}
