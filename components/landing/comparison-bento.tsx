"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ComparisonTable } from "./comparison-table";

export function ComparisonBento() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="comparison"
      className="bg-muted/30 px-6 py-24"
    >
      <div className="mx-auto max-w-5xl">
        {/* Section Header */}
        <div
          className={cn(
            "mb-8 text-center transition-all duration-500",
            isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
          )}
        >
          <h2 className="text-4xl md:text-5xl font-serif font-bold tracking-tight">
            Why teams choose{" "}
            <span className="text-primary relative">
              Loopforge
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
          </h2>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            The only platform that combines task management, AI assistance,
            autonomous code execution, and a visual workflow—all in one place.
          </p>
        </div>

        {/* Comparison Table */}
        <ComparisonTable isVisible={isVisible} />

        {/* Positioning Callout */}
        <div
          className={cn(
            "mt-8 rounded-xl border border-primary/20 bg-primary/5 p-6 text-center transition-all duration-500 md:p-8",
            isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
          )}
          style={{ transitionDelay: isVisible ? "400ms" : "0ms" }}
        >
          <p className="text-lg font-medium text-foreground md:text-xl">
            Other tools help you track tasks or write code.
          </p>
          <p className="mt-2 text-lg text-muted-foreground md:text-xl">
            Only <span className="font-semibold text-primary">Loopforge</span>{" "}
            shows you a complete visual workflow of AI agents building your
            software.
          </p>
        </div>
      </div>
    </section>
  );
}
