"use client";

import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/lib/utils";
import {
  Plus,
  GitBranch,
  ArrowLeft,
  RefreshCw,
  LayoutGrid,
  Network,
} from "lucide-react";
import Link from "next/link";
import { RepoData, statConfig } from "./use-task-actions";

interface RepoHeaderProps {
  repo: RepoData | null;
  taskStats: {
    total: number;
    inProgress: number;
    completed: number;
    stuck: number;
  };
  refreshing: boolean;
  view: "kanban" | "graph";
  onViewChange: (view: "kanban" | "graph") => void;
  onRefresh: () => void;
  onNewTask: () => void;
  onRepoUpdate?: (repo: RepoData) => void;
}

export function RepoHeader({
  repo,
  taskStats,
  refreshing,
  view,
  onViewChange,
  onRefresh,
  onNewTask,
  onRepoUpdate,
}: RepoHeaderProps) {
  return (
    <header
      className={cn(
        "flex-shrink-0 border-b bg-card/50 backdrop-blur-sm transition-opacity duration-300",
        !repo?.isCloned && "opacity-60",
      )}
    >
      <div className="px-6 lg:px-8 py-6">
        {/* Breadcrumb and actions row */}
        <div className="flex items-center justify-between mb-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>
          <div className="flex items-center gap-2">
            {/* View Switcher - positioned with actions */}
            <SegmentedControl
              options={[
                {
                  value: "kanban",
                  label: "Kanban",
                  icon: <LayoutGrid className="w-4 h-4" />,
                  ariaLabel: "Kanban board view",
                },
                {
                  value: "graph",
                  label: "Graph",
                  icon: <Network className="w-4 h-4" />,
                  ariaLabel: "Graph visualization view",
                },
              ]}
              value={view}
              onValueChange={(v) => onViewChange(v as "kanban" | "graph")}
            />

            <div className="w-px h-6 bg-border" />

            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={refreshing}
              className="gap-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200"
            >
              <RefreshCw
                className={cn("w-4 h-4", refreshing && "animate-spin")}
              />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button
              onClick={onNewTask}
              size="sm"
              className="gap-2"
              disabled={!repo?.isCloned}
            >
              <Plus className="w-4 h-4" />
              <span>New Task</span>
            </Button>
          </div>
        </div>

        {/* Title and description */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">
              {repo?.name || "Repository"}
            </h1>
            {repo?.fullName && (
              <div className="flex items-center gap-2 mt-1.5 text-muted-foreground">
                <GitBranch className="w-4 h-4" />
                <span className="text-sm font-mono">{repo.fullName}</span>
              </div>
            )}
          </div>

          {/* Quick stats and usage indicator */}
          <div className="flex items-center gap-4 sm:gap-6">
            {(
              Object.entries(taskStats) as [keyof typeof taskStats, number][]
            ).map(([key, value]) => {
              const config = statConfig[key];
              const Icon = config.icon;
              return (
                <div key={key} className="flex items-center gap-2">
                  <Icon className={cn("w-4 h-4", config.color)} />
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-semibold tabular-nums">
                      {value}
                    </span>
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {config.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
}
