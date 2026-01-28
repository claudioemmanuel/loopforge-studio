"use client";

import { useEffect, useRef, useState } from "react";
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

const features = [
  {
    icon: MessageSquareMore,
    title: "AI Brainstorming Chat",
    description:
      "Multi-turn conversation to refine requirements. Explore approaches and clarify scope before any code is written.",
  },
  {
    icon: GitCompare,
    title: "Diff Preview & Approval",
    description:
      "Review every AI-generated change before it's committed. See exactly what's being modified with visual diffs.",
  },
  {
    icon: KanbanSquare,
    title: "Visual Kanban Workflow",
    description:
      "Drag-and-drop tasks through a 7-stage AI pipeline. From brainstorm to done, every step is visible.",
  },
  {
    icon: Link2,
    title: "Task Dependencies",
    description:
      "Tasks block each other with auto-execute when unblocked. Build complex workflows with dependency chains.",
  },
  {
    icon: RotateCcw,
    title: "Rollback Safety",
    description:
      "Revert any AI execution with safety checks. One-click undo to restore your codebase to a previous state.",
  },
  {
    icon: Activity,
    title: "Activity Feed",
    description:
      "Real-time event tracking for all AI actions. Full audit trail of commits, executions, and changes.",
  },
];

export function FeaturesExpanded() {
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
            Everything you need to ship{" "}
            <span className="text-primary relative">
              faster
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
            A complete visual interface for autonomous AI coding. No more
            command lines, no more context switching.
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
