"use client";

import {
  Kanban,
  MessageSquare,
  Terminal,
  GitBranch,
  Bot,
  Server,
  BarChart3,
  Github,
} from "lucide-react";
import { useTranslations } from "next-intl";

const getPrimaryFeatures = () => [
  {
    icon: Kanban,
    titleKey: "visualKanban.title",
    descriptionKey: "visualKanban.description",
    phase: {
      bg: "bg-primary/10",
      bgHover: "group-hover:bg-primary/20",
      text: "text-primary",
      border: "hover:border-primary/30",
      shadow: "hover:shadow-primary/5",
    },
  },
  {
    icon: MessageSquare,
    titleKey: "aiBrainstorming.title",
    descriptionKey: "aiBrainstorming.description",
    phase: {
      bg: "bg-kanban-brainstorming/10",
      bgHover: "group-hover:bg-kanban-brainstorming/20",
      text: "text-kanban-brainstorming",
      border: "hover:border-kanban-brainstorming/30",
      shadow: "hover:shadow-kanban-brainstorming/5",
    },
  },
  {
    icon: Terminal,
    titleKey: "liveExecutionLogs.title",
    descriptionKey: "liveExecutionLogs.description",
    phase: {
      bg: "bg-kanban-executing/10",
      bgHover: "group-hover:bg-kanban-executing/20",
      text: "text-kanban-executing",
      border: "hover:border-kanban-executing/30",
      shadow: "hover:shadow-kanban-executing/5",
    },
  },
  {
    icon: GitBranch,
    titleKey: "directGitIntegration.title",
    descriptionKey: "directGitIntegration.description",
    phase: {
      bg: "bg-kanban-done/10",
      bgHover: "group-hover:bg-kanban-done/20",
      text: "text-kanban-done",
      border: "hover:border-kanban-done/30",
      shadow: "hover:shadow-kanban-done/5",
    },
  },
];

const getSecondaryFeatures = () => [
  {
    icon: Bot,
    titleKey: "multiAiProviders.title",
    descriptionKey: "multiAiProviders.description",
    phase: {
      bg: "bg-kanban-planning/10",
      bgHover: "group-hover:bg-kanban-planning/20",
      text: "text-kanban-planning",
      border: "hover:border-kanban-planning/30",
      shadow: "hover:shadow-kanban-planning/5",
    },
  },
  {
    icon: Server,
    titleKey: "cloudHosted.title",
    descriptionKey: "cloudHosted.description",
    phase: {
      bg: "bg-kanban-ready/10",
      bgHover: "group-hover:bg-kanban-ready/20",
      text: "text-kanban-ready",
      border: "hover:border-kanban-ready/30",
      shadow: "hover:shadow-kanban-ready/5",
    },
  },
  {
    icon: BarChart3,
    titleKey: "analyticsDashboard.title",
    descriptionKey: "analyticsDashboard.description",
    phase: {
      bg: "bg-kanban-done/10",
      bgHover: "group-hover:bg-kanban-done/20",
      text: "text-kanban-done",
      border: "hover:border-kanban-done/30",
      shadow: "hover:shadow-kanban-done/5",
    },
  },
  {
    icon: Github,
    titleKey: "githubOauth.title",
    descriptionKey: "githubOauth.description",
    phase: {
      bg: "bg-kanban-todo/10",
      bgHover: "group-hover:bg-kanban-todo/20",
      text: "text-kanban-todo",
      border: "hover:border-kanban-todo/30",
      shadow: "hover:shadow-kanban-todo/5",
    },
  },
];

export function Features() {
  const t = useTranslations("landing.features");
  const primaryFeatures = getPrimaryFeatures();
  const secondaryFeatures = getSecondaryFeatures();

  return (
    <section id="features" className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-3xl md:text-4xl font-serif font-bold tracking-tight">
            {t("sectionTitle").split(" ").slice(0, -1).join(" ")}{" "}
            <span className="text-primary">
              {t("sectionTitle").split(" ").slice(-1)[0]}
            </span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("sectionSubtitle")}
          </p>
        </div>

        {/* Primary features - 2x2 grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {primaryFeatures.map((feature, i) => (
            <div
              key={feature.titleKey}
              className={`group relative p-8 rounded-xl border border-border bg-card/50 backdrop-blur-sm transition-all duration-300 hover:bg-card/80 hover:shadow-lg hover:-translate-y-1 ${feature.phase.border} ${feature.phase.shadow}`}
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex-shrink-0 w-12 h-12 rounded-lg ${feature.phase.bg} flex items-center justify-center ${feature.phase.bgHover} transition-colors`}
                >
                  <feature.icon className={`w-6 h-6 ${feature.phase.text}`} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">
                    {t(feature.titleKey)}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {t(feature.descriptionKey)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Secondary features - 4 column grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {secondaryFeatures.map((feature, i) => (
            <div
              key={feature.titleKey}
              className={`group p-6 rounded-xl border border-border bg-card/30 transition-all duration-300 hover:bg-card/50 hover:-translate-y-1 hover:shadow-lg ${feature.phase.border} ${feature.phase.shadow}`}
              style={{ animationDelay: `${(i + 4) * 100}ms` }}
            >
              <div
                className={`w-10 h-10 rounded-lg ${feature.phase.bg} flex items-center justify-center mb-4 ${feature.phase.bgHover} transition-colors`}
              >
                <feature.icon className={`w-5 h-5 ${feature.phase.text}`} />
              </div>
              <h3 className="font-semibold mb-2">{t(feature.titleKey)}</h3>
              <p className="text-sm text-muted-foreground">
                {t(feature.descriptionKey)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
