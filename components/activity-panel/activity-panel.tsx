"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Activity, FileCode, History, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ActivityTab } from "./activity-tab";
import { ChangesTab } from "./changes-tab";
import { HistoryTab } from "./history-tab";

type TabType = "activity" | "changes" | "history";

interface ActivityPanelProps {
  repoId: string;
  className?: string;
}

const tabs: { id: TabType; label: string; icon: typeof Activity }[] = [
  { id: "activity", label: "Activity", icon: Activity },
  { id: "changes", label: "Changes", icon: FileCode },
  { id: "history", label: "History", icon: History },
];

export function ActivityPanel({ repoId, className }: ActivityPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("activity");
  const [hasNewActivity, setHasNewActivity] = useState(false);

  // Load expanded state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("activity-panel-expanded");
    if (stored !== null) {
      setIsExpanded(stored === "true");
    }
  }, []);

  // Save expanded state to localStorage
  useEffect(() => {
    localStorage.setItem("activity-panel-expanded", String(isExpanded));
  }, [isExpanded]);

  // Clear notification when panel is expanded
  useEffect(() => {
    if (isExpanded) {
      setHasNewActivity(false);
    }
  }, [isExpanded]);

  return (
    <>
      {/* Collapsed toggle button */}
      {!isExpanded && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(true)}
          className={cn(
            "fixed right-4 top-1/2 -translate-y-1/2 z-30",
            "flex flex-col items-center gap-1.5 py-3 px-2 h-auto",
            "bg-card border-border shadow-lg",
          )}
        >
          <Activity className="w-4 h-4" />
          <ChevronRight className="w-3 h-3" />
          {hasNewActivity && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full animate-pulse" />
          )}
        </Button>
      )}

      {/* Expanded panel */}
      <div
        className={cn(
          "fixed right-0 top-0 bottom-0 z-40 bg-card border-l border-border shadow-xl",
          "transition-transform duration-300 ease-in-out",
          isExpanded ? "translate-x-0" : "translate-x-full",
          "w-80",
          className,
        )}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold">Activity</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded(false)}
            className="h-8 w-8"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors",
                  "hover:bg-muted/50",
                  activeTab === tab.id
                    ? "text-foreground border-b-2 border-primary"
                    : "text-muted-foreground",
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div
          className="flex-1 overflow-hidden"
          style={{ height: "calc(100% - 110px)" }}
        >
          {activeTab === "activity" && (
            <ActivityTab
              repoId={repoId}
              onNewActivity={() => setHasNewActivity(true)}
            />
          )}
          {activeTab === "changes" && <ChangesTab repoId={repoId} />}
          {activeTab === "history" && <HistoryTab repoId={repoId} />}
        </div>
      </div>
    </>
  );
}
