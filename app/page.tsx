"use client";

import Link from "next/link";
import { LoopforgeLogo } from "@/components/loopforge-logo";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-br from-background to-secondary/30">
      <div className="max-w-2xl text-center space-y-8">
        <div className="space-y-4">
          <div className="mx-auto">
            <LoopforgeLogo size="2xl" animate={true} showSparks={true} showText={false} />
          </div>
          <h1 className="text-5xl font-serif font-bold tracking-tight !-mt-6">
            <span className="text-primary">Loop</span>forge
          </h1>
          <p className="text-xl text-muted-foreground">
            Visual Kanban interface for <em className="font-serif">autonomous</em> AI coding
          </p>
        </div>

        <div className="flex gap-4 justify-center">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Get Started
          </Link>
          <a
            href="https://github.com/loopforge/loopforge"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-medium shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            View on GitHub
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12">
          <div className="space-y-2 p-6 rounded-lg border bg-card">
            <h3 className="font-semibold">Kanban Board</h3>
            <p className="text-sm text-muted-foreground">
              Drag and drop tasks through your AI development workflow
            </p>
          </div>
          <div className="space-y-2 p-6 rounded-lg border bg-card">
            <h3 className="font-semibold">Live Execution</h3>
            <p className="text-sm text-muted-foreground">
              Watch AI think, code, and commit in real-time
            </p>
          </div>
          <div className="space-y-2 p-6 rounded-lg border bg-card">
            <h3 className="font-semibold">Direct Commits</h3>
            <p className="text-sm text-muted-foreground">
              AI commits directly to your working branches
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
