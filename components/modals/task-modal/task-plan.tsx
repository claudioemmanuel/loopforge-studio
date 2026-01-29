"use client";

import { cn } from "@/lib/utils";
import {
  FileText,
  Zap,
  CheckCircle2,
  AlertTriangle,
  GitBranch,
  Loader2,
  ChevronRight,
  Target,
  Layers,
  Gauge,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Task } from "@/lib/db/schema";
import { stripMarkdownCodeBlocks } from "./utils";

// Plan data interfaces
export interface PlanStep {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria?: string[];
  files?: string[];
  estimatedEffort?: "small" | "medium" | "large";
  priority?: "critical" | "high" | "medium" | "low";
  dependencies?: string[];
}

export interface PlanResult {
  sprintGoal?: string;
  overview: string;
  steps: PlanStep[];
  definitionOfDone?: string[];
  risks?: Array<{
    description: string;
    mitigation: string;
  }>;
  verification: string[];
}

export function parsePlanContent(content: string | null): PlanResult | null {
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch {
    // Try stripping markdown first, then parse
    try {
      const stripped = stripMarkdownCodeBlocks(content);
      return JSON.parse(stripped);
    } catch {
      return null;
    }
  }
}

export function calculatePlanSummary(plan: PlanResult | null): {
  stepCount: number;
  fileCount: number;
  complexity: number;
  criticalSteps: PlanStep[];
} {
  if (!plan) {
    return { stepCount: 0, fileCount: 0, complexity: 0, criticalSteps: [] };
  }

  const files = new Set<string>();
  let complexity = 0;
  const criticalSteps: PlanStep[] = [];

  for (const step of plan.steps) {
    // Count unique files
    if (step.files) {
      step.files.forEach((f) => files.add(f));
    }
    // Calculate complexity (S=1, M=2, L=3)
    if (step.estimatedEffort === "small") complexity += 1;
    else if (step.estimatedEffort === "medium") complexity += 2;
    else if (step.estimatedEffort === "large") complexity += 3;
    // Collect critical steps
    if (step.priority === "critical") {
      criticalSteps.push(step);
    }
  }

  return {
    stepCount: plan.steps.length,
    fileCount: files.size,
    complexity,
    criticalSteps,
  };
}

interface TaskPlanProps {
  task: Task;
  loading: boolean;
  actionType: string | null;
  onPlan: () => void;
}

export function TaskPlan({ task, loading, actionType, onPlan }: TaskPlanProps) {
  if (!task.planContent) return null;

  const plan = parsePlanContent(task.planContent);

  return (
    <>
      {/* Plan Content */}
      {(() => {
        if (!plan) {
          // Fallback to raw display if parsing fails
          return (
            <details className="group">
              <summary className="flex items-center gap-2 cursor-pointer select-none list-none hover:opacity-80 transition-opacity [&::-webkit-details-marker]:hidden">
                <ChevronRight className="w-4 h-4 text-blue-500 transition-transform duration-200 group-open:rotate-90" />
                <FileText className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-medium">Execution Plan</h3>
              </summary>
              <div className="mt-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200/50 dark:border-blue-800/30">
                <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
                  {task.planContent}
                </pre>
              </div>
            </details>
          );
        }
        return (
          <details className="group">
            <summary className="flex items-center gap-2 cursor-pointer select-none list-none hover:opacity-80 transition-opacity [&::-webkit-details-marker]:hidden">
              <ChevronRight className="w-4 h-4 text-blue-500 transition-transform duration-200 group-open:rotate-90" />
              <FileText className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-medium">Sprint Plan</h3>
            </summary>
            <div className="mt-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200/50 dark:border-blue-800/30 space-y-4">
              {/* Sprint Goal */}
              {plan.sprintGoal && (
                <div>
                  <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-1">
                    🎯 Sprint Goal
                  </h4>
                  <p className="text-sm font-medium leading-relaxed">
                    {plan.sprintGoal}
                  </p>
                </div>
              )}

              {/* Overview */}
              <div>
                <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-1">
                  Overview
                </h4>
                {plan.overview.includes("Failed to parse") ||
                plan.overview.includes("could not be parsed") ? (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200/50 dark:border-amber-800/30">
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-amber-700 dark:text-amber-300 font-medium text-sm">
                        Plan parsing issue
                      </p>
                      <p className="text-amber-600 dark:text-amber-400 text-xs mt-1">
                        The AI response couldn&apos;t be fully parsed.
                        Regenerate to get a properly structured plan.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={onPlan}
                        disabled={loading}
                        className="mt-3 gap-2 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                      >
                        {loading && actionType === "plan" ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <FileText className="w-3.5 h-3.5" />
                        )}
                        Regenerate Plan
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed">{plan.overview}</p>
                )}
              </div>

              {/* Sprint Backlog */}
              {plan.steps.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-2">
                    Sprint Backlog
                  </h4>
                  <ol className="text-sm space-y-4">
                    {plan.steps.map((step, i) => (
                      <li
                        key={step.id || i}
                        className="flex gap-3 p-3 bg-white/50 dark:bg-slate-800/30 rounded-lg border border-blue-100 dark:border-blue-800/30"
                      >
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 text-xs font-medium flex items-center justify-center">
                          {i + 1}
                        </span>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium">{step.title}</p>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {step.priority && (
                                <span
                                  className={cn(
                                    "text-xs px-1.5 py-0.5 rounded font-medium",
                                    step.priority === "critical" &&
                                      "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
                                    step.priority === "high" &&
                                      "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
                                    step.priority === "medium" &&
                                      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
                                    step.priority === "low" &&
                                      "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
                                  )}
                                >
                                  {step.priority}
                                </span>
                              )}
                              {step.estimatedEffort && (
                                <span
                                  className={cn(
                                    "text-xs px-1.5 py-0.5 rounded",
                                    step.estimatedEffort === "small" &&
                                      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
                                    step.estimatedEffort === "medium" &&
                                      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
                                    step.estimatedEffort === "large" &&
                                      "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
                                  )}
                                >
                                  {step.estimatedEffort === "small"
                                    ? "S"
                                    : step.estimatedEffort === "medium"
                                      ? "M"
                                      : "L"}
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-muted-foreground text-xs">
                            {step.description}
                          </p>

                          {/* Acceptance Criteria */}
                          {step.acceptanceCriteria &&
                            step.acceptanceCriteria.length > 0 && (
                              <div className="pt-2 border-t border-blue-100 dark:border-blue-800/30">
                                <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                                  Acceptance Criteria:
                                </p>
                                <ul className="text-xs space-y-0.5">
                                  {step.acceptanceCriteria.map((ac, j) => (
                                    <li
                                      key={j}
                                      className="flex items-start gap-1.5 text-muted-foreground"
                                    >
                                      <span className="text-blue-400">✓</span>
                                      <span>{ac}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                          {/* Files */}
                          {step.files && step.files.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {step.files.map((file, j) => (
                                <span
                                  key={j}
                                  className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 font-mono"
                                >
                                  {file}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Dependencies */}
                          {step.dependencies &&
                            step.dependencies.length > 0 && (
                              <p className="text-xs text-muted-foreground">
                                <span className="font-medium">Depends on:</span>{" "}
                                Task {step.dependencies.join(", ")}
                              </p>
                            )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Risks & Mitigations */}
              {plan.risks && plan.risks.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide mb-2">
                    ⚠️ Risks & Mitigations
                  </h4>
                  <ul className="text-sm space-y-2">
                    {plan.risks.map((risk, i) => (
                      <li
                        key={i}
                        className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200/50 dark:border-amber-800/30"
                      >
                        <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                          {risk.description}
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                          <span className="font-medium">Mitigation:</span>{" "}
                          {risk.mitigation}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Definition of Done */}
              {plan.definitionOfDone && plan.definitionOfDone.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide mb-1">
                    ✅ Definition of Done
                  </h4>
                  <ul className="text-sm space-y-1">
                    {plan.definitionOfDone.map((d, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-muted-foreground"
                      >
                        <span className="text-emerald-500">□</span>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Verification Steps */}
              {plan.verification && plan.verification.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-1">
                    Verification Steps
                  </h4>
                  <ul className="text-sm space-y-1">
                    {plan.verification.map((v, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        <span>{v}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </details>
        );
      })()}

      {/* Ready Confirmation Section - shown when task is ready or later */}
      {(task.status === "ready" ||
        task.status === "executing" ||
        task.status === "done") &&
        (() => {
          const summary = calculatePlanSummary(plan);
          return (
            <details className="group">
              <summary className="flex items-center gap-2 cursor-pointer select-none list-none hover:opacity-80 transition-opacity [&::-webkit-details-marker]:hidden">
                <ChevronRight className="w-4 h-4 text-amber-500 transition-transform duration-200 group-open:rotate-90" />
                <Zap className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-medium">Ready for Execution</h3>
              </summary>
              <div className="mt-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200/50 dark:border-amber-800/30 space-y-4">
                {/* Sprint Goal */}
                {plan?.sprintGoal && (
                  <div className="flex items-start gap-3">
                    <Target className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide mb-1">
                        Sprint Goal
                      </h4>
                      <p className="text-sm font-medium">{plan.sprintGoal}</p>
                    </div>
                  </div>
                )}

                {/* Scope Summary */}
                <div className="flex items-start gap-3">
                  <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide mb-1">
                      Scope Summary
                    </h4>
                    <p className="text-sm">
                      <span className="font-semibold">{summary.stepCount}</span>{" "}
                      step{summary.stepCount !== 1 ? "s" : ""}
                      {summary.fileCount > 0 ? (
                        <>
                          {" "}
                          across{" "}
                          <span className="font-semibold">
                            {summary.fileCount}
                          </span>{" "}
                          file{summary.fileCount !== 1 ? "s" : ""}
                        </>
                      ) : (
                        <span className="text-muted-foreground">
                          {" "}
                          (files determined at execution)
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Estimated Complexity */}
                <div className="flex items-start gap-3">
                  <Gauge className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide mb-1">
                      Estimated Complexity
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">
                        {summary.complexity} points
                      </span>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-xs font-medium",
                          summary.complexity <= 5 &&
                            "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
                          summary.complexity > 5 &&
                            summary.complexity <= 10 &&
                            "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
                          summary.complexity > 10 &&
                            "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
                        )}
                      >
                        {summary.complexity <= 5
                          ? "Low"
                          : summary.complexity <= 10
                            ? "Medium"
                            : "High"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Critical Steps */}
                {summary.criticalSteps.length > 0 && (
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-semibold text-red-700 dark:text-red-300 uppercase tracking-wide mb-1">
                        Critical Steps
                      </h4>
                      <ul className="text-sm space-y-1">
                        {summary.criticalSteps.map((step, i) => (
                          <li
                            key={step.id || i}
                            className="flex items-start gap-2"
                          >
                            <span className="text-red-500">•</span>
                            <span>{step.title}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Branch */}
                {task.branch && (
                  <div className="flex items-start gap-3">
                    <GitBranch className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide mb-1">
                        Target Branch
                      </h4>
                      <code className="text-sm font-mono bg-amber-100 dark:bg-amber-800/40 px-2 py-0.5 rounded">
                        {task.branch}
                      </code>
                    </div>
                  </div>
                )}
              </div>
            </details>
          );
        })()}
    </>
  );
}
