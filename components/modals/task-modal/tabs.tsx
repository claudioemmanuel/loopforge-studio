"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { FileText, Clock, Activity, Sparkles, GitBranch } from "lucide-react";

export type TabId = "details" | "timeline" | "execution" | "graph" | "skills";

interface TabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  showExecutionTab?: boolean;
  showGraphTab?: boolean;
  showSkillsTab?: boolean;
}

type TranslationFunction = (key: string) => string;

const getBaseTabs = (
  t: TranslationFunction,
): { id: TabId; label: string; icon: typeof FileText }[] => [
  { id: "details", label: t("tasks.tabs.details"), icon: FileText },
  { id: "timeline", label: t("tasks.tabs.timeline"), icon: Clock },
];

const getExecutionTab = (
  t: TranslationFunction,
): { id: TabId; label: string; icon: typeof FileText } => ({
  id: "execution",
  label: t("tasks.tabs.execution"),
  icon: Activity,
});

const getGraphTab = (
  t: TranslationFunction,
): { id: TabId; label: string; icon: typeof FileText } => ({
  id: "graph",
  label: t("tasks.tabs.graph"),
  icon: GitBranch,
});

const getSkillsTab = (
  t: TranslationFunction,
): { id: TabId; label: string; icon: typeof FileText } => ({
  id: "skills",
  label: t("tasks.tabs.skills"),
  icon: Sparkles,
});

export function TaskModalTabs({
  activeTab,
  onTabChange,
  showExecutionTab = false,
  showGraphTab = false,
  showSkillsTab = false,
}: TabsProps) {
  const t = useTranslations();

  const baseTabs = getBaseTabs(t);
  const optionalTabs = [];
  if (showGraphTab) optionalTabs.push(getGraphTab(t));
  if (showExecutionTab) optionalTabs.push(getExecutionTab(t));
  if (showSkillsTab) optionalTabs.push(getSkillsTab(t));

  const tabs = [...baseTabs, ...optionalTabs];

  return (
    <div className="border-b">
      <div className="flex gap-1 px-6">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
