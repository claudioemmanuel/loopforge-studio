"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
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
  Activity,
  Play,
  History,
  FolderGit2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LoopforgeIcon } from "@/components/loopforge-logo";
import { NotificationBellClient } from "@/components/workers";
import { RepoStatusDot } from "@/components/repo-status-indicator";
import { LanguageSwitcher } from "@/components/language-switcher";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { IndexingStatus } from "@/lib/db/schema";

interface SidebarRepo {
  id: string;
  name: string;
  fullName: string;
  taskCount: number;
  isCloned: boolean;
  indexingStatus: IndexingStatus;
  cloneStatus?: "pending" | "cloning" | "completed" | "failed";
}

interface SidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  repos?: SidebarRepo[];
}

// Note: Labels will be translated in the component using useTranslations
const settingsSubItems = [
  { href: "/settings/account", labelKey: "account", icon: User },
  { href: "/settings/connections", labelKey: "connections", icon: Plug },
  { href: "/settings/preferences", labelKey: "preferences", icon: Sliders },
  { href: "/settings/automation", labelKey: "automation", icon: GitBranch },
];

const activitySubItems = [
  { href: "/activity/active", labelKey: "activeTasks", icon: Play },
  { href: "/activity/history", labelKey: "history", icon: History },
  { href: "/activity/failed", labelKey: "failed", icon: AlertTriangle },
];

export function Sidebar({ user, repos = [] }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("navigation");
  const tSettings = useTranslations("settings");

  // Sidebar collapsed state with localStorage persistence
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    setMounted(true);
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
  const isRepositoriesActive =
    pathname === "/repositories" || pathname.startsWith("/repos/");
  const isActivityActive = pathname.startsWith("/activity");
  const isAnalyticsActive = pathname === "/analytics";
  const isSettingsActive = pathname.startsWith("/settings");

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "border-r bg-card flex flex-col transition-all duration-300 h-full",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <div
          className={cn(
            "p-4 border-b flex items-center justify-between",
            collapsed && "px-3",
          )}
        >
          <Link href="/dashboard" className="flex items-center gap-2">
            <LoopforgeIcon size={32} />
            {!collapsed && (
              <span className="font-serif font-bold text-lg">
                <span className="text-primary">Loopforge</span> Studio
              </span>
            )}
          </Link>
          {!collapsed && <NotificationBellClient />}
        </div>

        <nav
          className={cn(
            "flex-1 p-4 space-y-1 overflow-y-auto",
            collapsed && "px-2",
          )}
        >
          {!mounted ? (
            // Render neutral placeholder during SSR/hydration
            <div className="space-y-1">
              <div className="h-10 bg-muted/20 rounded-lg animate-pulse" />
              <div className="h-10 bg-muted/20 rounded-lg animate-pulse" />
              <div className="h-10 bg-muted/20 rounded-lg animate-pulse" />
            </div>
          ) : (
            <>
              {/* Dashboard (single view) */}
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href="/dashboard"
                      className={cn(
                        "flex items-center justify-center p-2 rounded-lg transition-colors",
                        isDashboardActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Home className="w-5 h-5" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">{t("dashboard")}</TooltipContent>
                </Tooltip>
              ) : (
                <Link
                  href="/dashboard"
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                    isDashboardActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Home className="w-4 h-4" />
                  {t("dashboard")}
                </Link>
              )}

              {/* Repositories with cascade */}
              <div>
                {collapsed ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className={cn(
                          "flex items-center justify-center p-2 rounded-lg transition-colors w-full",
                          isRepositoriesActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <FolderGit2 className="w-5 h-5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="right" className="w-56 p-2">
                      <div className="space-y-1">
                        <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
                          {t("repositories")}
                        </div>
                        <Link
                          href="/repositories"
                          className={cn(
                            "flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors",
                            pathname === "/repositories"
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted",
                          )}
                        >
                          <LayoutDashboard className="w-3.5 h-3.5" />
                          All Repositories
                        </Link>
                        {repos.length > 0 && (
                          <>
                            <div className="h-px bg-border my-1" />
                            {repos.map((repo) => {
                              const isRepoActive =
                                pathname === `/repos/${repo.id}`;
                              return (
                                <Link
                                  key={repo.id}
                                  href={`/repos/${repo.id}`}
                                  className={cn(
                                    "flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors",
                                    isRepoActive
                                      ? "bg-primary/10 text-primary font-medium"
                                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                                  )}
                                >
                                  <GitBranch className="w-3.5 h-3.5 flex-shrink-0" />
                                  <span className="flex-1 truncate">
                                    {repo.name}
                                  </span>
                                  <RepoStatusDot
                                    isCloned={repo.isCloned}
                                    indexingStatus={repo.indexingStatus}
                                    cloneStatus={repo.cloneStatus}
                                  />
                                </Link>
                              );
                            })}
                          </>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <>
                    <div
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm",
                        "text-muted-foreground",
                      )}
                    >
                      <FolderGit2 className="w-4 h-4" />
                      <span className="flex-1 text-left font-medium">
                        {t("repositories")}
                      </span>
                    </div>

                    <div className="ml-4 mt-1 space-y-0.5 border-l pl-3">
                      <Link
                        href="/repositories"
                        className={cn(
                          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors",
                          pathname === "/repositories"
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <LayoutDashboard className="w-3.5 h-3.5" />
                        {t("allRepositories")}
                      </Link>

                      {repos.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {repos.map((repo) => {
                            const isRepoActive =
                              pathname === `/repos/${repo.id}`;
                            return (
                              <Link
                                key={repo.id}
                                href={`/repos/${repo.id}`}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors",
                                  isRepoActive
                                    ? "bg-primary/10 text-primary font-medium"
                                    : "text-muted-foreground hover:text-foreground",
                                )}
                              >
                                <GitBranch className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="flex-1 truncate">
                                  {repo.name}
                                </span>
                                <RepoStatusDot
                                  isCloned={repo.isCloned}
                                  indexingStatus={repo.indexingStatus}
                                  cloneStatus={repo.cloneStatus}
                                />
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Activity with cascade */}
              <div>
                {collapsed ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className={cn(
                          "flex items-center justify-center p-2 rounded-lg transition-colors w-full",
                          isActivityActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Activity className="w-5 h-5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="right" className="w-52 p-2">
                      <div className="space-y-1">
                        <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
                          {t("activity")}
                        </div>
                        {activitySubItems.map((item) => {
                          const Icon = item.icon;
                          const isActive = pathname === item.href;
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={cn(
                                "flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors",
                                isActive
                                  ? "bg-primary/10 text-primary font-medium"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
                                item.href === "/execution/failed" &&
                                  !isActive &&
                                  "text-amber-500/70 hover:text-amber-500",
                              )}
                            >
                              <Icon
                                className={cn(
                                  "w-3.5 h-3.5",
                                  item.href === "/execution/failed" &&
                                    "text-amber-500",
                                )}
                              />
                              {t(item.labelKey as string)}
                            </Link>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <>
                    <div
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm",
                        "text-muted-foreground",
                      )}
                    >
                      <Activity className="w-4 h-4" />
                      <span className="flex-1 text-left font-medium">
                        {t("activity")}
                      </span>
                    </div>

                    <div className="ml-4 mt-1 space-y-0.5 border-l pl-3">
                      {activitySubItems.map((item) => {
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
                              item.href === "/execution/failed" &&
                                !isActive &&
                                "text-amber-500/70 hover:text-amber-500",
                            )}
                          >
                            <Icon
                              className={cn(
                                "w-3.5 h-3.5",
                                item.href === "/execution/failed" &&
                                  "text-amber-500",
                              )}
                            />
                            {t(item.labelKey as string)}
                          </Link>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Analytics (single view) */}
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href="/analytics"
                      className={cn(
                        "flex items-center justify-center p-2 rounded-lg transition-colors",
                        isAnalyticsActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <BarChart3 className="w-5 h-5" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">{t("analytics")}</TooltipContent>
                </Tooltip>
              ) : (
                <Link
                  href="/analytics"
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                    isAnalyticsActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <BarChart3 className="w-4 h-4" />
                  {t("analytics")}
                </Link>
              )}

              {/* Settings with cascade */}
              <div>
                {collapsed ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className={cn(
                          "flex items-center justify-center p-2 rounded-lg transition-colors w-full",
                          isSettingsActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Settings className="w-5 h-5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="right" className="w-48 p-2">
                      <div className="space-y-1">
                        <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
                          {t("settings")}
                        </div>
                        {settingsSubItems.map((item) => {
                          const Icon = item.icon;
                          const isActive = pathname === item.href;
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={cn(
                                "flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors",
                                isActive
                                  ? "bg-primary/10 text-primary font-medium"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
                              )}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              {item.href.startsWith("/settings")
                                ? tSettings(item.labelKey as string)
                                : t(item.labelKey as string)}
                            </Link>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <>
                    <div
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm",
                        "text-muted-foreground",
                      )}
                    >
                      <Settings className="w-4 h-4" />
                      <span className="flex-1 text-left font-medium">
                        {t("settings")}
                      </span>
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
                            )}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            {tSettings(item.labelKey as string)}
                          </Link>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </nav>

        {/* Toggle button */}
        <div className={cn("px-4 py-2 border-t", collapsed && "px-2")}>
          <button
            onClick={toggleCollapsed}
            className={cn(
              "flex items-center justify-center p-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors",
              collapsed ? "w-full" : "w-auto",
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
                      <Image
                        src={user.image}
                        alt={user.name || "User"}
                        width={32}
                        height={32}
                        className="rounded-full"
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
                <TooltipContent side="right">{t("signOut")}</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-3">
                {user.image ? (
                  <Image
                    src={user.image}
                    alt={user.name || "User"}
                    width={32}
                    height={32}
                    className="rounded-full"
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
                  <p className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <LanguageSwitcher />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  {t("signOut")}
                </Button>
              </div>
            </>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
