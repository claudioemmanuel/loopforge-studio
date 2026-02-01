"use client";

import { Suspense } from "react";
import { Sidebar } from "@/components/sidebar";
import { PageTransition } from "@/components/layout/page-transition";
import { WelcomeTutorialWrapper } from "@/components/onboarding";
import {
  SidebarProvider,
  MobileHeader,
  MobileSidebar,
} from "@/components/sidebar/index";

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

interface DashboardLayoutClientProps {
  children: React.ReactNode;
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  repos: SidebarRepo[];
  enableABTesting: boolean;
}

export function DashboardLayoutClient({
  children,
  user,
  repos,
  enableABTesting,
}: DashboardLayoutClientProps) {
  return (
    <SidebarProvider>
      <div className="flex h-screen bg-background">
        {/* Desktop sidebar - hidden on mobile */}
        <div className="hidden md:block sidebar-static">
          <Sidebar
            user={user}
            repos={repos}
            enableABTesting={enableABTesting}
          />
        </div>

        {/* Mobile header - visible only on mobile */}
        <MobileHeader />

        {/* Mobile sidebar drawer */}
        <MobileSidebar
          user={user}
          repos={repos}
          enableABTesting={enableABTesting}
        />

        {/* Main content with top padding on mobile for fixed header */}
        <main className="flex-1 overflow-auto pt-14 md:pt-0">
          <PageTransition className="h-full">{children}</PageTransition>
        </main>

        <Suspense fallback={null}>
          <WelcomeTutorialWrapper />
        </Suspense>
      </div>
    </SidebarProvider>
  );
}
