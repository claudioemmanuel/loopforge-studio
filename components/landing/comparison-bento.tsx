"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { ComparisonTable } from "./comparison-table";
import { Squircle } from "@/components/ui/squircle";

export function ComparisonBento() {
  const t = useTranslations();
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
            {t("landing.comparisonBento.title")
              .split(" ")
              .slice(0, -1)
              .join(" ")}{" "}
            <span className="text-primary relative">
              {t("landing.comparisonBento.title").split(" ").slice(-1)[0]}
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
            {t("landing.comparisonBento.subtitle")}
          </p>
        </div>

        {/* Comparison Table */}
        <ComparisonTable isVisible={isVisible} />

        {/* Positioning Callout */}
        <Squircle
          cornerRadius="xl"
          borderWidth={1}
          borderColor="hsl(var(--primary) / 0.2)"
          className={cn(
            "mt-8 rounded-xl bg-primary/5 p-6 text-center transition-all duration-500 md:p-8",
            isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
          )}
          style={{ transitionDelay: isVisible ? "400ms" : "0ms" }}
        >
          <p className="text-lg font-medium text-foreground md:text-xl">
            {t("landing.comparisonBento.callout.prefix")}
          </p>
          <p className="mt-2 text-lg text-muted-foreground md:text-xl">
            {
              t("landing.comparisonBento.callout.suffix").split(
                t("landing.comparisonBento.callout.highlight"),
              )[0]
            }
            <span className="font-semibold text-primary">
              {t("landing.comparisonBento.callout.highlight")}
            </span>
            {
              t("landing.comparisonBento.callout.suffix").split(
                t("landing.comparisonBento.callout.highlight"),
              )[1]
            }
          </p>
        </Squircle>
      </div>
    </section>
  );
}
