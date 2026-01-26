"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoopforgeIcon } from "@/components/loopforge-logo";
import { NotificationBellClient } from "@/components/workers";
import { useSidebar } from "./sidebar-context";

export function MobileHeader() {
  const { openSidebar } = useSidebar();

  return (
    <header className="fixed top-0 left-0 right-0 h-14 z-40 md:hidden bg-card border-b flex items-center justify-between px-4">
      <Link href="/dashboard" className="flex items-center gap-2">
        <LoopforgeIcon size={28} />
        <span className="font-serif font-bold text-lg">
          <span className="text-primary">Loopforge</span> Studio
        </span>
      </Link>
      <div className="flex items-center gap-1">
        <NotificationBellClient />
        <Button
          variant="ghost"
          size="icon"
          onClick={openSidebar}
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </Button>
      </div>
    </header>
  );
}
