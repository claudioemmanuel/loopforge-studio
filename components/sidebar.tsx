"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import {
  Home,
  BarChart3,
  Settings,
  LogOut,
  LayoutDashboard,
  GitBranch,
  User,
  Sliders,
  Plug,
  AlertTriangle,
  PanelLeftClose,
  PanelLeft,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LoopforgeIcon } from "@/components/loopforge-logo";
import { NotificationBellClient } from "@/components/workers";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SidebarRepo {
  id: string;
  name: string;
  fullName: string;
  taskCount: number;
}

interface SidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  repos?: SidebarRepo[];
}

const settingsSubItems = [
  { href: "/settings/account", label: "Account", icon: User },
  { href: "/settings/preferences", label: "Preferences", icon: Sliders },
  { href: "/settings/integrations", label: "Integrations", icon: Plug },
  { href: "/settings/danger-zone", label: "Danger Zone", icon: AlertTriangle },
];

export function Sidebar({ user, repos = [] }: SidebarProps) {
  const pathname = usePathname();

  // Sidebar collapsed state with localStorage persistence
  const [collapsed, setCollapsed] = useState(false);

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored !== null) {
      setCollapsed(stored === "true");
    }
  }, []);

  const toggleCollapsed = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    localStorage.setItem("sidebar-collapsed", String(newState));
  };

  const isDashboardActive = pathname === "/dashboard";
  const isWorkersActive = pathname === "/workers";
  const isAnalyticsActive = pathname === "/analytics";
  const isSettingsActive = pathname.startsWith("/settings");

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "border-r bg-card flex flex-col transition-all duration-300 h-full",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <div className={cn("p-4 border-b flex items-center justify-between", collapsed && "px-3")}>
          <Link href="/dashboard" className="flex items-center gap-2">
            <LoopforgeIcon size={32} />
            {!collapsed && (
              <span className="font-serif font-bold text-lg">
                <span className="text-primary">Loop</span>forge
              </span>
            )}
          </Link>
          {!collapsed && <NotificationBellClient />}
        </div>

        <nav className={cn("flex-1 p-4 space-y-1 overflow-y-auto", collapsed && "px-2")}>
        {/* Dashboard with cascade */}
        <div>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/dashboard"
                  className={cn(
                    "flex items-center justify-center p-2 rounded-lg transition-colors",
                    isDashboardActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Home className="w-5 h-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Dashboard</TooltipContent>
            </Tooltip>
          ) : (
            <>
              <div
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm",
                  "text-muted-foreground"
                )}
              >
                <Home className="w-4 h-4" />
                <span className="flex-1 text-left font-medium">Dashboard</span>
              </div>

              <div className="ml-4 mt-1 space-y-1 border-l pl-3">
                <Link
                  href="/dashboard"
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors",
                    isDashboardActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  Overview
                </Link>

                {repos.length > 0 && (
                  <div className="pt-1">
                    <span className="px-3 text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">
                      Repositories
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {repos.map((repo) => {
                        const isRepoActive = pathname === `/repos/${repo.id}`;
                        return (
                          <Link
                            key={repo.id}
                            href={`/repos/${repo.id}`}
                            className={cn(
                              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors",
                              isRepoActive
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <GitBranch className="w-3.5 h-3.5" />
                            <span className="flex-1 truncate">{repo.name}</span>
                            {repo.taskCount > 0 && (
                              <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                {repo.taskCount}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Workers */}
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/workers"
                className={cn(
                  "flex items-center justify-center p-2 rounded-lg transition-colors",
                  isWorkersActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Zap className="w-5 h-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Workers</TooltipContent>
          </Tooltip>
        ) : (
          <Link
            href="/workers"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
              isWorkersActive
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Zap className="w-4 h-4" />
            Workers
          </Link>
        )}

        {/* Settings with cascade */}
        <div>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/settings/account"
                  className={cn(
                    "flex items-center justify-center p-2 rounded-lg transition-colors",
                    isSettingsActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Settings className="w-5 h-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Settings</TooltipContent>
            </Tooltip>
          ) : (
            <>
              <div
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm",
                  "text-muted-foreground"
                )}
              >
                <Settings className="w-4 h-4" />
                <span className="flex-1 text-left font-medium">Settings</span>
              </div>

              <div className="ml-4 mt-1 space-y-0.5 border-l pl-3">
                {settingsSubItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:text-foreground",
                        item.href === "/settings/danger-zone" && !isActive && "text-red-500/70 hover:text-red-500"
                      )}
                    >
                      <Icon className={cn(
                        "w-3.5 h-3.5",
                        item.href === "/settings/danger-zone" && "text-red-500"
                      )} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Analytics (no cascade) */}
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/analytics"
                className={cn(
                  "flex items-center justify-center p-2 rounded-lg transition-colors",
                  isAnalyticsActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <BarChart3 className="w-5 h-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Analytics</TooltipContent>
          </Tooltip>
        ) : (
          <Link
            href="/analytics"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
              isAnalyticsActive
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <BarChart3 className="w-4 h-4" />
            Analytics
          </Link>
        )}
      </nav>

      {/* Toggle button */}
      <div className={cn("px-4 py-2 border-t", collapsed && "px-2")}>
        <button
          onClick={toggleCollapsed}
          className={cn(
            "flex items-center justify-center p-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors",
            collapsed ? "w-full" : "w-auto"
          )}
        >
          {collapsed ? (
            <PanelLeft className="w-5 h-5" />
          ) : (
            <PanelLeftClose className="w-5 h-5" />
          )}
        </button>
      </div>

      <div className={cn("p-4 border-t", collapsed && "p-2")}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  {user.image ? (
                    <img
                      src={user.image}
                      alt={user.name || "User"}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <span className="text-sm font-medium">
                        {user.name?.[0] || "U"}
                      </span>
                    </div>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-3">
              {user.image ? (
                <img
                  src={user.image}
                  alt={user.name || "User"}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-sm font-medium">
                    {user.name?.[0] || "U"}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </Button>
          </>
        )}
      </div>
    </aside>
    </TooltipProvider>
  );
}
