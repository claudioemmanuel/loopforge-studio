"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Squircle, useSquircle } from "@/components/ui/squircle";

export function CTASection() {
  const primaryCta = useSquircle({ cornerRadius: "lg" });
  const secondaryCta = useSquircle({ cornerRadius: "lg" });

  return (
    <section className="py-24 px-6 relative overflow-hidden bg-background">
      {/* Decorative blur circles — keep rounded-full */}
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
            <div
              className="animate-glow-pulse"
              style={{
                filter: "drop-shadow(0 10px 15px hsl(var(--primary) / 0.25))",
              }}
            >
              <Link
                href="/login"
                ref={primaryCta.ref as React.RefObject<HTMLAnchorElement>}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-8 py-4 text-base font-medium text-primary-foreground transition-all hover:bg-primary/90 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={primaryCta.style}
              >
                Start Building Free
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
            <Squircle
              cornerRadius="lg"
              borderWidth={1}
              borderColor="hsl(var(--border))"
            >
              <a
                href="https://github.com/claudioemmanuel/loopforge-studio"
                target="_blank"
                rel="noopener noreferrer"
                ref={secondaryCta.ref as React.RefObject<HTMLAnchorElement>}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-background/50 px-8 py-4 text-base font-medium transition-all hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={secondaryCta.style}
              >
                View on GitHub
              </a>
            </Squircle>
          </div>

          <p className="text-sm text-muted-foreground">
            Free tier available. No credit card required.
          </p>
        </div>
      </div>
    </section>
  );
}
