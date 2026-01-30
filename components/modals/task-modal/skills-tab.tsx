"use client";

import { formatDistanceToNow } from "date-fns";
import { SkillBadge } from "@/components/kanban/skill-badge";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Sparkles,
  Info,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface SkillExecution {
  skillId: string;
  status: "passed" | "warning" | "blocked";
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface SkillsTabProps {
  skillExecutions?: SkillExecution[];
}

const STATUS_CONFIG = {
  passed: {
    icon: CheckCircle,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-900/20",
    borderColor: "border-green-200 dark:border-green-800",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "bg-yellow-50 dark:bg-yellow-900/20",
    borderColor: "border-yellow-200 dark:border-yellow-800",
  },
  blocked: {
    icon: XCircle,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-900/20",
    borderColor: "border-red-200 dark:border-red-800",
  },
};

export function SkillsTab({ skillExecutions = [] }: SkillsTabProps) {
  if (skillExecutions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="p-4 rounded-full bg-muted/50 mb-4">
          <Sparkles className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No Skills Executed Yet</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Skills will automatically execute during task processing to enforce
          best practices and methodological discipline.
        </p>
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 max-w-md">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="text-xs text-blue-700 dark:text-blue-300">
              <p className="font-medium mb-1">Skills are enabled by default</p>
              <p>
                They trigger automatically during brainstorming, planning, and
                execution phases.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Group executions by status
  const grouped = skillExecutions.reduce(
    (acc, execution) => {
      acc[execution.status].push(execution);
      return acc;
    },
    { passed: [], warning: [], blocked: [] } as Record<
      "passed" | "warning" | "blocked",
      SkillExecution[]
    >,
  );

  const stats = {
    total: skillExecutions.length,
    passed: grouped.passed.length,
    warning: grouped.warning.length,
    blocked: grouped.blocked.length,
  };

  return (
    <ScrollArea className="h-[500px]">
      <div className="space-y-6 p-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {stats.passed}
            </div>
            <div className="text-xs text-green-700 dark:text-green-300">
              Passed
            </div>
          </div>
          <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {stats.warning}
            </div>
            <div className="text-xs text-yellow-700 dark:text-yellow-300">
              Warnings
            </div>
          </div>
          <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {stats.blocked}
            </div>
            <div className="text-xs text-red-700 dark:text-red-300">
              Blocked
            </div>
          </div>
        </div>

        {/* Execution History */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Execution History
          </h3>

          <div className="space-y-3">
            {skillExecutions
              .sort(
                (a, b) =>
                  new Date(b.timestamp).getTime() -
                  new Date(a.timestamp).getTime(),
              )
              .map((execution, index) => {
                const config = STATUS_CONFIG[execution.status];
                const StatusIcon = config.icon;

                return (
                  <div
                    key={`${execution.skillId}-${execution.timestamp}-${index}`}
                    className={`p-4 rounded-lg border ${config.bgColor} ${config.borderColor}`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <StatusIcon
                          className={`w-4 h-4 ${config.color} flex-shrink-0`}
                        />
                        <div className="flex items-center gap-2 flex-wrap">
                          <SkillBadge
                            skillId={execution.skillId}
                            status={execution.status}
                            compact={false}
                          />
                          <Badge
                            variant="outline"
                            className={`text-xs ${config.color} ${config.bgColor} border-0`}
                          >
                            {execution.status.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(execution.timestamp), {
                          addSuffix: true,
                        })}
                      </div>
                    </div>

                    {/* Message */}
                    <div className="text-sm mb-2">{execution.message}</div>

                    {/* Metadata */}
                    {execution.metadata &&
                      Object.keys(execution.metadata).length > 0 && (
                        <details className="mt-3">
                          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                            Additional Details
                          </summary>
                          <div className="mt-2 p-2 bg-muted/50 rounded text-xs font-mono">
                            <pre className="whitespace-pre-wrap break-all">
                              {JSON.stringify(execution.metadata, null, 2)}
                            </pre>
                          </div>
                        </details>
                      )}
                  </div>
                );
              })}
          </div>
        </div>

        {/* Help Text */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-700 dark:text-blue-300">
              <p className="font-medium mb-1">About Skills</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>
                  <strong>Passed:</strong> Skill requirements met, workflow
                  continues
                </li>
                <li>
                  <strong>Warning:</strong> Issues detected, recommendations
                  provided
                </li>
                <li>
                  <strong>Blocked:</strong> Critical issues prevent progression
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
