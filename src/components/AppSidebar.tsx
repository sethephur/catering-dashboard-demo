import type { ComponentType } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  CalendarDays,
  CalendarRange,
  FileCog,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Moon,
  Settings,
  Sun,
  UserRoundCog,
  Users,
} from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { APP_WORKSPACE_LABEL } from "@/config/appInfo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type NavItem = {
  label: string;
  to: string;
  icon: ComponentType<{ className?: string }>;
};

const workspaceItems: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Inquiries", to: "/dashboard#inquiry-inbox", icon: FileText },
  { label: "Clients", to: "/clients", icon: Users },
  { label: "Events", to: "/events", icon: CalendarRange },
  { label: "Calendar", to: "/calendar", icon: CalendarDays },
  { label: "Reports", to: "/reports", icon: BarChart3 },
];

const adminItems: NavItem[] = [
  { label: "Support", to: "/support", icon: LifeBuoy },
  { label: "Settings", to: "/settings", icon: Settings },
];

const documentItems: NavItem[] = [
  {
    label: "Email Templates",
    to: "/settings#settings-email-templates",
    icon: FileText,
  },
  {
    label: "Contract Templates",
    to: "/settings#settings-contract-templates",
    icon: FileCog,
  },
];

type AppSidebarProps = {
  isDark: boolean;
  onToggleTheme: () => void;
  onLogout: () => void | Promise<void>;
};

const toTitleCase = (value: string) =>
  value
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export function AppSidebar({
  isDark,
  onToggleTheme,
  onLogout,
}: AppSidebarProps) {
  const { isAdmin, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const visibleAdminItems = isAdmin
    ? adminItems
    : adminItems.filter((item) => item.to !== "/support");
  const headerTitle = (() => {
    const displayName = user?.displayName?.trim();
    if (displayName) return displayName;

    const emailLocalPart = user?.email?.split("@")[0]?.trim();
    if (emailLocalPart) return toTitleCase(emailLocalPart);

    return APP_WORKSPACE_LABEL;
  })();
  const headerSubtitle = user?.email?.trim() || "Workspace";

  const isRouteActive = (path: string) => {
    const [pathname, hash] = path.split("#");
    if ((pathname || "") !== location.pathname) {
      return !hash && location.pathname.startsWith(pathname || path);
    }
    return hash ? location.hash === `#${hash}` : true;
  };

  const renderNavItems = (items: NavItem[]) =>
    items.map((item) => {
      const Icon = item.icon;
      const isActive = isRouteActive(item.to);
      const [itemPathname, itemHash] = item.to.split("#");

      return (
        <SidebarMenuItem key={item.to}>
          <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
            <NavLink
              to={item.to}
              onClick={(event) => {
                const isSamePath = location.pathname === itemPathname;

                if (!itemHash && isSamePath) {
                  event.preventDefault();
                  navigate(itemPathname || item.to, { replace: true });
                  window.setTimeout(() => {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }, 40);
                  return;
                }

                if (!itemHash || !isSamePath) return;

                event.preventDefault();
                navigate(item.to, {
                  replace: location.hash === `#${itemHash}`,
                });

                window.setTimeout(() => {
                  document
                    .getElementById(itemHash)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 80);
              }}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    });

  return (
    <Sidebar
      collapsible="offcanvas"
      className="group-data-[side=left]:border-r-0"
    >
      <SidebarHeader className="p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-auto w-full justify-start rounded-xl bg-sidebar-accent/40 px-2.5 py-2 text-left text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground cursor-pointer"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                      <LayoutDashboard className="size-4" />
                    </div>
                    <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">
                        {headerTitle}
                      </span>
                      <span className="truncate text-xs text-sidebar-foreground/65">
                        {headerSubtitle}
                      </span>
                    </div>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel className="space-y-1">
                  <div className="truncate text-sm font-medium">
                    {headerTitle}
                  </div>
                  <div className="truncate text-xs font-normal text-muted-foreground">
                    {headerSubtitle}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate("/account")}>
                  <UserRoundCog className="size-4" />
                  Account settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => {
                    void onLogout();
                  }}
                >
                  <LogOut className="size-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderNavItems(workspaceItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Documents</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderNavItems(documentItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4">
          <SidebarGroupLabel>Admin</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderNavItems(visibleAdminItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <div className="rounded-xl border border-sidebar-border/80 bg-sidebar-accent/50 p-3">
          <div className="flex items-center justify-between gap-3 group-data-[collapsible=icon]:justify-center">
            <div className="group-data-[collapsible=icon]:hidden">
              <p className="text-sm font-medium">Appearance</p>
              <p className="text-xs text-sidebar-foreground/65">
                {isDark ? "Dark mode" : "Light mode"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full hover:bg-sidebar-accent"
              aria-label={
                isDark ? "Switch to light mode" : "Switch to dark mode"
              }
              onClick={onToggleTheme}
            >
              {isDark ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <Button
          variant="ghost"
          className="w-full justify-start border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center"
          onClick={onLogout}
        >
          <span className="group-data-[collapsible=icon]:hidden">Logout</span>
          <span className="hidden group-data-[collapsible=icon]:inline">
            Out
          </span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
