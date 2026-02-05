"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useCallback } from "react";
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
  X,
  Activity,
  Play,
  History,
  FolderGit2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LoopforgeIcon } from "@/components/loopforge-logo";
import { RepoStatusDot } from "@/components/repo-status-indicator";
import { useSidebar } from "./sidebar-context";
import { LanguageSwitcher } from "@/components/language-switcher";
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

interface MobileSidebarProps {
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

export function MobileSidebar({ user, repos = [] }: MobileSidebarProps) {
  const pathname = usePathname();
  const { isOpen, closeSidebar } = useSidebar();
  const t = useTranslations("navigation");
  const tSettings = useTranslations("settings");

  const isDashboardActive = pathname === "/dashboard";
  const isRepositoriesActive =
    pathname === "/repositories" || pathname.startsWith("/repos/");
  const isActivityActive = pathname.startsWith("/activity");
  const isAnalyticsActive = pathname === "/analytics";
  const isSettingsActive = pathname.startsWith("/settings");

  // Close sidebar on route change
  useEffect(() => {
    closeSidebar();
  }, [pathname, closeSidebar]);

  // Close sidebar on escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeSidebar();
      }
    },
    [closeSidebar],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 md:hidden transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={closeSidebar}
        aria-hidden="true"
      />

      {/* Sidebar drawer */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-[280px] bg-card border-r flex flex-col md:hidden",
          "transform transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Header with close button */}
        <div className="p-4 border-b flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <LoopforgeIcon size={32} />
            <span className="font-serif font-bold text-lg">
              <span className="text-primary">Loopforge</span> Studio
            </span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={closeSidebar}
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {/* Dashboard (single view) */}
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

          {/* Repositories with cascade */}
          <div>
            <div className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground">
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
                    const isRepoActive = pathname === `/repos/${repo.id}`;
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
                        <span className="flex-1 truncate">{repo.name}</span>
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
          </div>

          {/* Activity with cascade */}
          <div>
            <div className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground">
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
                        item.href === "/execution/failed" && "text-amber-500",
                      )}
                    />
                    {t(item.labelKey as string)}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Analytics (single view) */}
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

          {/* Settings with cascade */}
          <div>
            <div className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground">
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
                    {item.href.startsWith("/settings")
                      ? tSettings(item.labelKey as string)
                      : t(item.labelKey as string)}
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        {/* User section */}
        <div className="p-4 border-t">
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
        </div>
      </aside>
    </>
  );
}
