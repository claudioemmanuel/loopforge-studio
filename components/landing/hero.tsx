"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { LoopforgeLogo } from "@/components/loopforge-logo";
import { ArrowRight, Play } from "lucide-react";

const ModernKanban = dynamic(() =>
  import("./modern-kanban").then((mod) => mod.ModernKanban),
);

export function Hero() {
  return (
    <section className="min-h-screen pt-24 pb-8 px-6 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl -z-10" />

      <div className="max-w-4xl mx-auto text-center space-y-8">
        {/* Logo */}
        <div className="mx-auto animate-fade-up animation-delay-100">
          <LoopforgeLogo
            size="2xl"
            animate={true}
            showSparks={true}
            showText={false}
          />
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif font-bold tracking-tight !-mt-4 animate-fade-up animation-delay-200">
          Ship code while you{" "}
          <span className="text-primary relative">
            sleep
            <svg
              className="absolute -bottom-2 left-0 w-full"
              viewBox="0 0 200 12"
              fill="none"
            >
              <path
                d="M2 10C50 2 150 2 198 10"
                stroke="hsl(var(--primary))"
                strokeWidth="3"
                strokeLinecap="round"
                opacity="0.4"
              />
            </svg>
          </span>
        </h1>

        {/* Subheadline */}
        <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto animate-fade-up animation-delay-300">
          <span className="text-primary">Loopforge</span> Studio lets you
          brainstorm, plan, and execute coding tasks with AI—while you focus on
          what matters.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4 animate-fade-up animation-delay-400">
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-8 py-4 text-base font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Start Building Free
            <ArrowRight className="w-5 h-5" />
          </Link>
          <a
            href="#workflow"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background/50 px-8 py-4 text-base font-medium shadow-sm transition-all hover:bg-muted/50 hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Play className="w-5 h-5" />
            See How It Works
          </a>
        </div>
      </div>

      {/* Modern Kanban demo - outside max-w container for full width */}
      <ModernKanban className="animate-fade-up animation-delay-500 w-full max-w-6xl mt-8" />
    </section>
  );
}
