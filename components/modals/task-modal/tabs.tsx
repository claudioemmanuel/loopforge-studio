"use client";

import { cn } from "@/lib/utils";
import { FileText, Clock } from "lucide-react";

export type TabId = "details" | "timeline";

interface TabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const tabs: { id: TabId; label: string; icon: typeof FileText }[] = [
  { id: "details", label: "Details", icon: FileText },
  { id: "timeline", label: "Timeline", icon: Clock },
];

export function TaskModalTabs({ activeTab, onTabChange }: TabsProps) {
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
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
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
