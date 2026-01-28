"use client";

import Link from "next/link";
import { LoopforgeLogo } from "@/components/loopforge-logo";

export function Navigation() {
  return (
    <nav className="fixed top-0 w-full z-[100] backdrop-blur-md bg-background/80 border-b border-border/50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <LoopforgeLogo
            size="sm"
            animate={false}
            showSparks={false}
            showText={false}
          />
          <span className="text-lg font-semibold tracking-tight">
            <span className="text-primary">Loopforge</span> Studio
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <a
            href="https://github.com/claudioemmanuel/loopforge-studio"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            GitHub
          </a>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Sign In
          </Link>
        </div>
      </div>
    </nav>
  );
}
