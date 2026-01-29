"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useCallback } from "react";
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
  Zap,
  Play,
  History,
  CreditCard,
  FlaskConical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LoopforgeIcon } from "@/components/loopforge-logo";
import { RepoStatusDot } from "@/components/repo-status-indicator";
import { useSidebar } from "./sidebar-context";
import type { IndexingStatus } from "@/lib/db/schema";
import { getFeatureFlag } from "@/lib/config/feature-flags";

interface SidebarRepo {
  id: string;
  name: string;
  fullName: string;
  taskCount: number;
  isCloned: boolean;
  indexingStatus: IndexingStatus;
}

interface MobileSidebarProps {
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
  { href: "/subscription", label: "Billing", icon: CreditCard },
  { href: "/settings/danger-zone", label: "Danger Zone", icon: AlertTriangle },
];

const workersSubItems = [
  { href: "/workers", label: "Active", icon: Play },
  { href: "/workers/history", label: "History", icon: History },
  { href: "/workers/failed", label: "Failed", icon: AlertTriangle },
];

export function MobileSidebar({ user, repos = [] }: MobileSidebarProps) {
  const pathname = usePathname();
  const { isOpen, closeSidebar } = useSidebar();

  const isDashboardActive = pathname === "/dashboard";
  const isAnalyticsActive = pathname === "/analytics";
  const isExperimentsActive = pathname === "/experiments";

  const enableABTesting = getFeatureFlag("ENABLE_AB_TESTING");

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
          {/* Dashboard with cascade */}
          <div>
            <div className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground">
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
                    : "text-muted-foreground hover:text-foreground",
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
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <GitBranch className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="flex-1 truncate">{repo.name}</span>
                          <RepoStatusDot
                            isCloned={repo.isCloned}
                            indexingStatus={repo.indexingStatus}
                          />
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
          </div>

          {/* Workers with cascade */}
          <div>
            <div className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground">
              <Zap className="w-4 h-4" />
              <span className="flex-1 text-left font-medium">Workers</span>
            </div>

            <div className="ml-4 mt-1 space-y-0.5 border-l pl-3">
              {workersSubItems.map((item) => {
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
                      item.href === "/workers/failed" &&
                        !isActive &&
                        "text-amber-500/70 hover:text-amber-500",
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-3.5 h-3.5",
                        item.href === "/workers/failed" && "text-amber-500",
                      )}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Settings with cascade */}
          <div>
            <div className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground">
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
                      item.href === "/settings/danger-zone" &&
                        !isActive &&
                        "text-red-500/70 hover:text-red-500",
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-3.5 h-3.5",
                        item.href === "/settings/danger-zone" && "text-red-500",
                      )}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Analytics */}
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
            Analytics
          </Link>

          {/* Experiments */}
          {enableABTesting && (
            <Link
              href="/experiments"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                isExperimentsActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <FlaskConical className="w-4 h-4" />
              Experiments
            </Link>
          )}
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
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </Button>
        </div>
      </aside>
    </>
  );
}
