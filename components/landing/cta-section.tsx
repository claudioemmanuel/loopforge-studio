"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function CTASection() {
  return (
    <section className="py-24 px-6 relative overflow-hidden">
      {/* Decorative blur circles */}
      <div className="absolute top-0 left-1/4 w-64 h-64 bg-primary/20 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-accent/20 rounded-full blur-3xl -z-10" />

      <div className="max-w-4xl mx-auto text-center">
        <div className="space-y-8">
          <h2 className="text-4xl md:text-5xl font-serif font-bold tracking-tight">
            Ready to ship code on{" "}
            <span className="text-primary relative">
              autopilot
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
            ?
          </h2>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Join developers who are shipping faster with AI-powered autonomous
            coding.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-8 py-4 text-base font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring animate-glow-pulse"
            >
              Start Building Free
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a
              href="https://github.com/claudioemmanuel/loopforge-studio"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background/50 px-8 py-4 text-base font-medium shadow-sm transition-all hover:bg-muted/50 hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              View on GitHub
            </a>
          </div>

          <p className="text-sm text-muted-foreground">
            Free tier available. No credit card required.
          </p>
        </div>
      </div>
    </section>
  );
}
