"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  Check,
  Minus,
  X,
  KanbanSquare,
  Sparkles,
  Code2,
  Workflow,
} from "lucide-react";

type SupportLevel = "full" | "partial" | "none";

interface Competitor {
  name: string;
  isLoopforge?: boolean;
  taskMgmt: SupportLevel;
  aiAssists: SupportLevel;
  aiExecutes: SupportLevel;
  visualWorkflow: SupportLevel;
}

// Helper function to get competitors with translations
function getCompetitors(t: (key: string) => string): Competitor[] {
  return [
    {
      name: t("landing.comparison.competitors.loopforge"),
      isLoopforge: true,
      taskMgmt: "full",
      aiAssists: "full",
      aiExecutes: "full",
      visualWorkflow: "full",
    },
    {
      name: t("landing.comparison.competitors.linear"),
      taskMgmt: "full",
      aiAssists: "partial",
      aiExecutes: "none",
      visualWorkflow: "none",
    },
    {
      name: t("landing.comparison.competitors.github"),
      taskMgmt: "full",
      aiAssists: "full",
      aiExecutes: "full",
      visualWorkflow: "none",
    },
    {
      name: t("landing.comparison.competitors.notion"),
      taskMgmt: "full",
      aiAssists: "full",
      aiExecutes: "none",
      visualWorkflow: "none",
    },
    {
      name: t("landing.comparison.competitors.jira"),
      taskMgmt: "full",
      aiAssists: "full",
      aiExecutes: "partial",
      visualWorkflow: "none",
    },
    {
      name: t("landing.comparison.competitors.trello"),
      taskMgmt: "full",
      aiAssists: "partial",
      aiExecutes: "none",
      visualWorkflow: "none",
    },
    {
      name: t("landing.comparison.competitors.asana"),
      taskMgmt: "full",
      aiAssists: "full",
      aiExecutes: "none",
      visualWorkflow: "none",
    },
    {
      name: t("landing.comparison.competitors.monday"),
      taskMgmt: "full",
      aiAssists: "full",
      aiExecutes: "none",
      visualWorkflow: "none",
    },
  ];
}

// Helper function to get pillars with translations
function getPillars(t: (key: string) => string) {
  return [
    {
      icon: KanbanSquare,
      title: t("landing.comparison.pillars.taskManagement.title"),
      description: t("landing.comparison.pillars.taskManagement.description"),
    },
    {
      icon: Sparkles,
      title: t("landing.comparison.pillars.aiAssists.title"),
      description: t("landing.comparison.pillars.aiAssists.description"),
    },
    {
      icon: Code2,
      title: t("landing.comparison.pillars.aiExecutesCode.title"),
      description: t("landing.comparison.pillars.aiExecutesCode.description"),
    },
    {
      icon: Workflow,
      title: t("landing.comparison.pillars.visualWorkflow.title"),
      description: t("landing.comparison.pillars.visualWorkflow.description"),
      isUnique: true,
    },
  ];
}

function StatusIndicator({ level }: { level: SupportLevel }) {
  if (level === "full") {
    return (
      <div className="flex items-center justify-center">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
          <Check className="h-4 w-4 text-primary" />
        </div>
      </div>
    );
  }
  if (level === "partial") {
    return (
      <div className="flex items-center justify-center">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-kanban-ready/10">
          <Minus className="h-4 w-4 text-kanban-ready" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center">
      <X className="h-4 w-4 text-muted-foreground/40" />
    </div>
  );
}

function PillarCard({
  pillar,
  index,
  isVisible,
}: {
  pillar: ReturnType<typeof getPillars>[0];
  index: number;
  isVisible: boolean;
}) {
  const t = useTranslations();
  const Icon = pillar.icon;

  return (
    <div
      className={cn(
        "relative rounded-xl border bg-card p-6 transition-all duration-300",
        "hover:-translate-y-1 hover:shadow-lg",
        pillar.isUnique && "border-primary/50 bg-primary/5",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
      )}
      style={{
        transitionDelay: isVisible ? `${index * 100}ms` : "0ms",
      }}
    >
      {pillar.isUnique && (
        <div className="absolute -top-3 right-4">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
            <Sparkles className="h-3 w-3" />
            {t("landing.comparison.badges.onlyUs")}
          </span>
        </div>
      )}
      <div
        className={cn(
          "mb-4 flex h-12 w-12 items-center justify-center rounded-lg",
          pillar.isUnique ? "bg-primary/20" : "bg-secondary",
        )}
      >
        <Icon
          className={cn(
            "h-6 w-6",
            pillar.isUnique ? "text-primary" : "text-foreground",
          )}
        />
      </div>
      <h3 className="mb-2 font-semibold">{pillar.title}</h3>
      <p className="text-sm text-muted-foreground">{pillar.description}</p>
    </div>
  );
}

function MobileComparisonCard({
  competitor,
  isVisible,
  index,
}: {
  competitor: Competitor;
  isVisible: boolean;
  index: number;
}) {
  const t = useTranslations();

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 transition-all duration-300",
        competitor.isLoopforge && "border-l-4 border-l-primary bg-primary/5",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
      )}
      style={{
        transitionDelay: isVisible ? `${index * 50}ms` : "0ms",
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="font-medium">{competitor.name}</span>
        {competitor.isLoopforge && (
          <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
            {t("landing.comparison.badges.youAreHere")}
          </span>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        <div>
          <div className="mb-1 text-[10px] text-muted-foreground">
            {t("landing.comparison.mobile.tasks")}
          </div>
          <StatusIndicator level={competitor.taskMgmt} />
        </div>
        <div>
          <div className="mb-1 text-[10px] text-muted-foreground">
            {t("landing.comparison.mobile.aiHelp")}
          </div>
          <StatusIndicator level={competitor.aiAssists} />
        </div>
        <div>
          <div className="mb-1 text-[10px] text-muted-foreground">
            {t("landing.comparison.mobile.aiCode")}
          </div>
          <StatusIndicator level={competitor.aiExecutes} />
        </div>
        <div>
          <div className="mb-1 text-[10px] text-muted-foreground">
            {t("landing.comparison.mobile.visual")}
          </div>
          <StatusIndicator level={competitor.visualWorkflow} />
        </div>
      </div>
    </div>
  );
}

export function Comparison() {
  const t = useTranslations();
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  const competitors = getCompetitors(t);
  const pillars = getPillars(t);

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
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div
          className={cn(
            "mb-16 text-center transition-all duration-500",
            isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
          )}
        >
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
            {t("landing.comparison.title").split(" ").slice(0, -1).join(" ")}{" "}
            <span className="font-serif text-primary">
              {t("landing.comparison.title").split(" ").slice(-1)[0]}
            </span>
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            {t("landing.comparison.subtitle")}
          </p>
        </div>

        {/* Differentiator Pillars */}
        <div className="mb-16 grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
          {pillars.map((pillar, index) => (
            <PillarCard
              key={pillar.title}
              pillar={pillar}
              index={index}
              isVisible={isVisible}
            />
          ))}
        </div>

        {/* Desktop Comparison Table */}
        <div
          className={cn(
            "hidden overflow-hidden rounded-xl border bg-card shadow-sm transition-all duration-500 md:block",
            isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
          )}
          style={{ transitionDelay: isVisible ? "400ms" : "0ms" }}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-6 py-4 text-left font-medium">
                    {t("landing.comparison.table.platform")}
                  </th>
                  <th className="px-4 py-4 text-center font-medium">
                    {t("landing.comparison.pillars.taskManagement.title")}
                  </th>
                  <th className="px-4 py-4 text-center font-medium">
                    {t("landing.comparison.pillars.aiAssists.title")}
                  </th>
                  <th className="px-4 py-4 text-center font-medium">
                    {t("landing.comparison.pillars.aiExecutesCode.title")}
                  </th>
                  <th className="px-4 py-4 text-center font-medium">
                    <div className="flex items-center justify-center gap-1">
                      <Sparkles className="h-4 w-4 text-primary" />
                      {t("landing.comparison.pillars.visualWorkflow.title")}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {competitors.map((competitor) => (
                  <tr
                    key={competitor.name}
                    className={cn(
                      "border-b last:border-b-0",
                      competitor.isLoopforge &&
                        "border-l-4 border-l-primary bg-primary/5",
                    )}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "font-medium",
                            competitor.isLoopforge && "text-primary",
                          )}
                        >
                          {competitor.name}
                        </span>
                        {competitor.isLoopforge && (
                          <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
                            {t("landing.comparison.badges.youAreHere")}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <StatusIndicator level={competitor.taskMgmt} />
                    </td>
                    <td className="px-4 py-4">
                      <StatusIndicator level={competitor.aiAssists} />
                    </td>
                    <td className="px-4 py-4">
                      <StatusIndicator level={competitor.aiExecutes} />
                    </td>
                    <td className="px-4 py-4">
                      <StatusIndicator level={competitor.visualWorkflow} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Comparison Cards */}
        <div className="space-y-3 md:hidden">
          {competitors.map((competitor, index) => (
            <MobileComparisonCard
              key={competitor.name}
              competitor={competitor}
              isVisible={isVisible}
              index={index}
            />
          ))}
        </div>

        {/* Positioning Callout */}
        <div
          className={cn(
            "mt-12 rounded-xl border border-primary/20 bg-primary/5 p-6 text-center transition-all duration-500 md:p-8",
            isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
          )}
          style={{ transitionDelay: isVisible ? "500ms" : "0ms" }}
        >
          <p className="text-lg font-medium text-foreground md:text-xl">
            {t("landing.comparison.callout.prefix")}
          </p>
          <p className="mt-2 text-lg text-muted-foreground md:text-xl">
            {
              t("landing.comparison.callout.suffix").split(
                t("landing.comparison.callout.highlight"),
              )[0]
            }
            <span className="font-semibold text-primary">
              {t("landing.comparison.callout.highlight")}
            </span>
            {
              t("landing.comparison.callout.suffix").split(
                t("landing.comparison.callout.highlight"),
              )[1]
            }
          </p>
        </div>
      </div>
    </section>
  );
}
