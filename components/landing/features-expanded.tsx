"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  MessageSquareMore,
  GitCompare,
  KanbanSquare,
  Link2,
  RotateCcw,
  Activity,
} from "lucide-react";
import { FeatureCard } from "./feature-card";

// Helper function to get features with translations
function getFeatures(t: (key: string) => string) {
  return [
    {
      icon: MessageSquareMore,
      title: t("landing.featuresExpanded.aiBrainstorming.title"),
      description: t("landing.featuresExpanded.aiBrainstorming.description"),
    },
    {
      icon: GitCompare,
      title: t("landing.featuresExpanded.diffPreview.title"),
      description: t("landing.featuresExpanded.diffPreview.description"),
    },
    {
      icon: KanbanSquare,
      title: t("landing.featuresExpanded.visualKanban.title"),
      description: t("landing.featuresExpanded.visualKanban.description"),
    },
    {
      icon: Link2,
      title: t("landing.featuresExpanded.taskDependencies.title"),
      description: t("landing.featuresExpanded.taskDependencies.description"),
    },
    {
      icon: RotateCcw,
      title: t("landing.featuresExpanded.rollbackSafety.title"),
      description: t("landing.featuresExpanded.rollbackSafety.description"),
    },
    {
      icon: Activity,
      title: t("landing.featuresExpanded.activityFeed.title"),
      description: t("landing.featuresExpanded.activityFeed.description"),
    },
  ];
}

export function FeaturesExpanded() {
  const t = useTranslations();
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  const features = getFeatures(t);

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

  const titleWords = t("landing.featuresExpanded.sectionTitle").split(" ");
  const highlighted = titleWords.slice(-1)[0]; // "faster"
  const rest = titleWords.slice(0, -1).join(" "); // "Everything you need to ship"

  return (
    <section
      ref={sectionRef}
      id="features"
      className="py-24 px-6 bg-background"
    >
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <div
          className={cn(
            "text-center space-y-4 mb-16 transition-all duration-500",
            isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
          )}
        >
          <h2 className="text-4xl md:text-5xl font-serif font-bold tracking-tight">
            {rest}{" "}
            <span className="text-primary relative">
              {highlighted}
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
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("landing.featuresExpanded.sectionSubtitle")}
          </p>
        </div>

        {/* 2x3 Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <FeatureCard
              key={feature.title}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              index={index}
              isVisible={isVisible}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
