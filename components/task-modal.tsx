"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  X,
  Clock,
  Lightbulb,
  FileText,
  Zap,
  Play,
  CheckCircle2,
  AlertTriangle,
  GitBranch,
  Sparkles,
  Loader2,
  ChevronRight,
  Calendar,
  AlertCircle,
  Settings,
  Target,
  Layers,
  Gauge,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import type { Task, TaskStatus } from "@/lib/db/schema";
import { BrainstormPanel } from "@/components/brainstorm-panel";
import { useAPIError } from "@/components/hooks/use-api-error";
import { ErrorDialog } from "@/components/ui/error-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// Helper to strip markdown code blocks
function stripMarkdownCodeBlocks(text: string): string {
  let cleaned = text.trim();
  // Remove opening code fence with optional language
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  // Remove closing code fence
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

// Helper to parse brainstorm result
interface BrainstormResult {
  summary: string;
  requirements: string[];
  considerations: string[];
  suggestedApproach: string;
}

function parseBrainstormResult(result: string | null): BrainstormResult | null {
  if (!result) return null;
  try {
    // First try parsing as-is
    const parsed = JSON.parse(result);
    // If suggestedApproach looks like raw JSON, try to extract actual value
    if (parsed.suggestedApproach?.startsWith("```") || parsed.suggestedApproach?.startsWith("{")) {
      const stripped = stripMarkdownCodeBlocks(parsed.suggestedApproach);
      try {
        const nested = JSON.parse(stripped);
        // Use fields from nested if they exist
        return {
          summary: nested.summary || parsed.summary,
          requirements: nested.requirements?.length ? nested.requirements : parsed.requirements,
          considerations: nested.considerations?.length ? nested.considerations : parsed.considerations,
          suggestedApproach: nested.suggestedApproach || parsed.suggestedApproach,
        };
      } catch {
        // Keep original parsed if nested parsing fails
      }
    }
    return parsed;
  } catch {
    // Try stripping markdown first, then parse
    try {
      const stripped = stripMarkdownCodeBlocks(result);
      return JSON.parse(stripped);
    } catch {
      // If still fails, return null to show raw text
      return null;
    }
  }
}

// Helper to parse plan content (Scrum Sprint Planning format)
interface PlanStep {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria?: string[];
  files?: string[];
  estimatedEffort?: "small" | "medium" | "large";
  priority?: "critical" | "high" | "medium" | "low";
  dependencies?: string[];
}

interface PlanResult {
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

function parsePlanContent(content: string | null): PlanResult | null {
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

// Helper to calculate plan summary for Ready Confirmation section
function calculatePlanSummary(plan: PlanResult | null): {
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
      step.files.forEach(f => files.add(f));
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

interface TaskModalProps {
  task: Task;
  onClose: () => void;
  onUpdate: (task: Task) => void;
  autoStartBrainstorm?: boolean;
}

// Simple markdown-like text renderer
function renderFormattedText(text: string): React.ReactNode {
  // Split by **bold** patterns
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

// Status configuration
const statusConfig: Record<
  TaskStatus,
  {
    icon: typeof Lightbulb;
    label: string;
    color: string;
    bgColor: string;
    description: string;
  }
> = {
  todo: {
    icon: Clock,
    label: "To Do",
    color: "text-slate-600 dark:text-slate-400",
    bgColor: "bg-slate-100 dark:bg-slate-800",
    description: "Waiting to start",
  },
  brainstorming: {
    icon: Lightbulb,
    label: "Brainstorming",
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-100 dark:bg-violet-900/40",
    description: "AI generating ideas",
  },
  planning: {
    icon: FileText,
    label: "Planning",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/40",
    description: "Creating execution plan",
  },
  ready: {
    icon: Zap,
    label: "Ready",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/40",
    description: "Ready to execute",
  },
  executing: {
    icon: Play,
    label: "Executing",
    color: "text-primary",
    bgColor: "bg-primary/10",
    description: "AI working on code",
  },
  done: {
    icon: CheckCircle2,
    label: "Done",
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/40",
    description: "Task completed",
  },
  stuck: {
    icon: AlertTriangle,
    label: "Stuck",
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/40",
    description: "Needs attention",
  },
};

// Workflow steps for progress indicator
const workflowSteps: TaskStatus[] = [
  "todo",
  "brainstorming",
  "planning",
  "ready",
  "executing",
  "done",
];

export function TaskModal({ task, onClose, onUpdate, autoStartBrainstorm = false }: TaskModalProps) {
  const [loading, setLoading] = useState(false);
  const [actionType, setActionType] = useState<string | null>(null);
  const [showBrainstormPanel, setShowBrainstormPanel] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [autoStartTriggered, setAutoStartTriggered] = useState(false);
  const [autonomousMode, setAutonomousMode] = useState(task.autonomousMode ?? false);
  const [togglingAutonomous, setTogglingAutonomous] = useState(false);
  const [showAutonomousConfirm, setShowAutonomousConfirm] = useState(false);

  // Error handling
  const {
    error: apiError,
    retryCountdown,
    isApiKeyError,
    clearError,
    handleAPIResponse,
  } = useAPIError();

  const config = statusConfig[task.status];
  const StatusIcon = config.icon;

  // Get current step index for workflow
  const currentStepIndex = workflowSteps.indexOf(task.status);
  const isStuck = task.status === "stuck";

  const handleApiError = useCallback(async (res: Response) => {
    await handleAPIResponse(res);
  }, [handleAPIResponse]);

  // Get status label for confirmation dialog
  const getStatusLabel = (status: TaskStatus): string => {
    const labels: Record<TaskStatus, string> = {
      todo: "To Do",
      brainstorming: "Brainstorming",
      planning: "Planning",
      ready: "Ready",
      executing: "Executing",
      done: "Done",
      stuck: "Stuck",
    };
    return labels[status] || status;
  };

  const handleToggleAutonomous = async () => {
    // If enabling (not disabling) and not in "todo" status, show confirmation
    if (!autonomousMode && task.status !== "todo") {
      setShowAutonomousConfirm(true);
      return;
    }

    // For "todo" status or disabling, proceed directly
    await executeToggleAutonomous(false);
  };

  const executeToggleAutonomous = async (useResumeEndpoint: boolean) => {
    setTogglingAutonomous(true);
    try {
      let res: Response;

      if (useResumeEndpoint) {
        // Use the resume endpoint which enables autonomous mode and may auto-start execution
        res = await fetch(`/api/tasks/${task.id}/autonomous/resume`, {
          method: "POST",
        });
      } else {
        // Standard toggle via PATCH
        res = await fetch(`/api/tasks/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ autonomousMode: !autonomousMode }),
        });
      }

      if (res.ok) {
        const updatedTask = await res.json();
        setAutonomousMode(updatedTask.autonomousMode);
        onUpdate(updatedTask);
      } else {
        await handleApiError(res);
      }
    } catch (err) {
      console.error("Error toggling autonomous mode:", err);
    } finally {
      setTogglingAutonomous(false);
    }
  };

  const handleConfirmAutonomous = async () => {
    setShowAutonomousConfirm(false);
    await executeToggleAutonomous(true);
  };

  const handleBrainstorm = useCallback(async () => {
    // Call API to generate initial brainstorm result
    setLoading(true);
    setActionType("brainstorm");
    clearError();
    try {
      const res = await fetch(`/api/tasks/${task.id}/brainstorm/generate`, {
        method: "POST",
      });
      if (res.ok) {
        const updatedTask = await res.json();
        onUpdate(updatedTask);
        // Don't open panel - result is shown in modal
      } else {
        await handleApiError(res);
      }
    } catch (err) {
      console.error("Error brainstorming:", err);
    } finally {
      setLoading(false);
      setActionType(null);
    }
  }, [task.id, clearError, onUpdate, handleApiError]);

  const handleRefine = () => {
    // Open interactive brainstorm panel for refinement
    setShowBrainstormPanel(true);
  };

  // Track mount state for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-start brainstorm when requested (calls API, doesn't open panel)
  useEffect(() => {
    if (autoStartBrainstorm && !autoStartTriggered && task.status === "todo") {
      setAutoStartTriggered(true);
      handleBrainstorm();
    }
  }, [autoStartBrainstorm, autoStartTriggered, task.status, handleBrainstorm]);

  const handleBrainstormFinalize = async () => {
    // Refresh task data after brainstorm finishes
    try {
      const res = await fetch(`/api/tasks/${task.id}`);
      if (res.ok) {
        const updatedTask = await res.json();
        onUpdate(updatedTask);
      }
    } catch (error) {
      console.error("Error refreshing task:", error);
    }
  };

  const handlePlan = async () => {
    setLoading(true);
    setActionType("plan");
    clearError();
    try {
      const res = await fetch(`/api/tasks/${task.id}/plan`, {
        method: "POST",
      });
      if (res.ok) {
        const updatedTask = await res.json();
        onUpdate(updatedTask);
      } else {
        await handleApiError(res);
      }
    } catch (err) {
      console.error("Error planning:", err);
      // Network errors - show inline since no structured error
    } finally {
      setLoading(false);
      setActionType(null);
    }
  };

  const handleMarkReady = async () => {
    setLoading(true);
    setActionType("ready");
    clearError();
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ready" }),
      });
      if (res.ok) {
        const updatedTask = await res.json();
        onUpdate(updatedTask);
      } else {
        await handleApiError(res);
      }
    } catch (err) {
      console.error("Error marking ready:", err);
      // Network errors - show inline since no structured error
    } finally {
      setLoading(false);
      setActionType(null);
    }
  };

  const handleStartExecution = async () => {
    setLoading(true);
    setActionType("execute");
    clearError();
    try {
      const res = await fetch(`/api/tasks/${task.id}/execute`, {
        method: "POST",
      });
      if (res.ok) {
        const updatedTask = await res.json();
        onUpdate(updatedTask);
      } else {
        await handleApiError(res);
      }
    } catch (err) {
      console.error("Error starting execution:", err);
      // Network errors - show inline since no structured error
    } finally {
      setLoading(false);
      setActionType(null);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden bg-card rounded-2xl shadow-2xl border animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="border-b">
          <div className="flex items-start justify-between p-6 pb-4">
            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h2 className="text-xl font-serif font-bold tracking-tight">
                  {task.title}
                </h2>
                {/* Autonomous Mode Toggle */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={handleToggleAutonomous}
                    disabled={togglingAutonomous || task.status === "executing" || task.status === "done"}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                      autonomousMode ? "bg-amber-500" : "bg-muted"
                    )}
                    title="When enabled, this task will progress automatically through all stages without manual approval"
                  >
                    <span
                      className={cn(
                        "inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-white shadow-sm transition-transform",
                        autonomousMode ? "translate-x-5" : "translate-x-0.5"
                      )}
                    >
                      <Zap className={cn("w-3 h-3", autonomousMode ? "text-amber-500" : "text-muted-foreground")} />
                    </span>
                  </button>
                  {autonomousMode && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                      <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                      Autonomous
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {/* Status badge */}
                <div
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                    config.bgColor,
                    config.color
                  )}
                >
                  <StatusIcon className="w-3.5 h-3.5" />
                  <span>{config.label}</span>
                </div>

                {/* Branch */}
                {task.branch && (
                  <div className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-full text-xs font-mono text-muted-foreground">
                    <GitBranch className="w-3 h-3" />
                    <span className="truncate max-w-[150px]">{task.branch}</span>
                  </div>
                )}

                {/* Timestamps */}
                {task.createdAt && (
                  <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    <span>Created {format(task.createdAt, "MMM d, yyyy")}</span>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              className="flex-shrink-0 p-2 -m-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Autonomous Mode Alert - inside header, above the border */}
          {task.autonomousMode && (
            <div className="mx-6 mb-4 flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Zap className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                <span className="font-medium">Autonomous Mode enabled.</span>{" "}
                This task will progress automatically through all stages without manual approval.
              </p>
            </div>
          )}
        </div>

        {/* Content - Scrollable */}
        <div className="overflow-y-auto max-h-[calc(90vh-200px)] p-6 space-y-6">
          {/* Error Alert - inline display for simple errors */}
          {apiError && !apiError.action && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-destructive font-medium">{apiError.message}</p>
                {isApiKeyError && (
                  <Link
                    href="/settings/integrations"
                    className="inline-flex items-center gap-1.5 mt-2 text-sm text-primary hover:underline"
                  >
                    <Settings className="w-4 h-4" />
                    Go to Settings
                  </Link>
                )}
              </div>
              <button
                onClick={clearError}
                className="flex-shrink-0 p-1 -m-1 rounded text-destructive/60 hover:text-destructive transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Workflow Progress (not for stuck tasks) */}
          {!isStuck && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                Workflow Progress
              </h3>
              <div className="flex items-center gap-1">
                {workflowSteps.map((step, index) => {
                  const stepConfig = statusConfig[step];
                  const StepIcon = stepConfig.icon;
                  const isCompleted = index < currentStepIndex;
                  const isCurrent = index === currentStepIndex;

                  return (
                    <div key={step} className="flex items-center">
                      <div
                        className={cn(
                          "flex items-center justify-center w-8 h-8 rounded-full transition-colors",
                          isCompleted && "bg-primary text-primary-foreground",
                          isCurrent && [stepConfig.bgColor, stepConfig.color],
                          !isCompleted && !isCurrent && "bg-muted text-muted-foreground"
                        )}
                      >
                        <StepIcon className="w-4 h-4" />
                      </div>
                      {index < workflowSteps.length - 1 && (
                        <div
                          className={cn(
                            "w-4 sm:w-8 h-0.5 mx-0.5",
                            index < currentStepIndex ? "bg-primary" : "bg-border"
                          )}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Description */}
          {task.description && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                Description
              </h3>
              <p className="text-sm leading-relaxed">{task.description}</p>
            </div>
          )}

          {/* Brainstorm Result */}
          {task.brainstormResult && (() => {
            const brainstorm = parseBrainstormResult(task.brainstormResult);
            if (!brainstorm) {
              // Fallback to raw display if parsing fails
              return (
                <details className="group" open>
                  <summary className="flex items-center gap-2 cursor-pointer select-none list-none hover:opacity-80 transition-opacity [&::-webkit-details-marker]:hidden">
                    <ChevronRight className="w-4 h-4 text-violet-500 transition-transform duration-200 group-open:rotate-90" />
                    <Lightbulb className="w-4 h-4 text-violet-500" />
                    <h3 className="text-sm font-medium">Brainstorm Result</h3>
                  </summary>
                  <div className="mt-3 p-4 bg-violet-50 dark:bg-violet-900/20 rounded-xl border border-violet-200/50 dark:border-violet-800/30">
                    <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
                      {task.brainstormResult}
                    </pre>
                  </div>
                </details>
              );
            }
            return (
              <details className="group" open>
                <summary className="flex items-center gap-2 cursor-pointer select-none list-none hover:opacity-80 transition-opacity [&::-webkit-details-marker]:hidden">
                  <ChevronRight className="w-4 h-4 text-violet-500 transition-transform duration-200 group-open:rotate-90" />
                  <Lightbulb className="w-4 h-4 text-violet-500" />
                  <h3 className="text-sm font-medium">Brainstorm Result</h3>
                </summary>
                <div className="mt-3 p-4 bg-violet-50 dark:bg-violet-900/20 rounded-xl border border-violet-200/50 dark:border-violet-800/30 space-y-4">
                  {/* Summary */}
                  <div>
                    <h4 className="text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide mb-1">Summary</h4>
                    <p className="text-sm leading-relaxed">{brainstorm.summary}</p>
                  </div>

                  {/* Requirements */}
                  {brainstorm.requirements.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide mb-1">Requirements</h4>
                      <ul className="text-sm space-y-1">
                        {brainstorm.requirements.map((req, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-violet-500 mt-1">•</span>
                            <span>{renderFormattedText(req)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Considerations */}
                  {brainstorm.considerations.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide mb-1">Considerations</h4>
                      <ul className="text-sm space-y-1">
                        {brainstorm.considerations.map((con, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-violet-500 mt-1">•</span>
                            <span>{renderFormattedText(con)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Suggested Approach */}
                  {brainstorm.suggestedApproach && (
                    <div>
                      <h4 className="text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide mb-1">Suggested Approach</h4>
                      <p className="text-sm leading-relaxed">{renderFormattedText(brainstorm.suggestedApproach)}</p>
                    </div>
                  )}
                </div>
              </details>
            );
          })()}

          {/* Plan Content */}
          {task.planContent && (() => {
            const plan = parsePlanContent(task.planContent);
            if (!plan) {
              // Fallback to raw display if parsing fails
              return (
                <details className="group" open>
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
              <details className="group" open>
                <summary className="flex items-center gap-2 cursor-pointer select-none list-none hover:opacity-80 transition-opacity [&::-webkit-details-marker]:hidden">
                  <ChevronRight className="w-4 h-4 text-blue-500 transition-transform duration-200 group-open:rotate-90" />
                  <FileText className="w-4 h-4 text-blue-500" />
                  <h3 className="text-sm font-medium">Sprint Plan</h3>
                </summary>
                <div className="mt-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200/50 dark:border-blue-800/30 space-y-4">
                  {/* Sprint Goal */}
                  {plan.sprintGoal && (
                    <div>
                      <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-1">🎯 Sprint Goal</h4>
                      <p className="text-sm font-medium leading-relaxed">{plan.sprintGoal}</p>
                    </div>
                  )}

                  {/* Overview */}
                  <div>
                    <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-1">Overview</h4>
                    {plan.overview.includes("Failed to parse") || plan.overview.includes("could not be parsed") ? (
                      <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200/50 dark:border-amber-800/30">
                        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-amber-700 dark:text-amber-300 font-medium text-sm">Plan parsing issue</p>
                          <p className="text-amber-600 dark:text-amber-400 text-xs mt-1">
                            The AI response couldn&apos;t be fully parsed. Regenerate to get a properly structured plan.
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handlePlan}
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
                      <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-2">Sprint Backlog</h4>
                      <ol className="text-sm space-y-4">
                        {plan.steps.map((step, i) => (
                          <li key={step.id || i} className="flex gap-3 p-3 bg-white/50 dark:bg-slate-800/30 rounded-lg border border-blue-100 dark:border-blue-800/30">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 text-xs font-medium flex items-center justify-center">
                              {i + 1}
                            </span>
                            <div className="flex-1 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <p className="font-medium">{step.title}</p>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  {step.priority && (
                                    <span className={cn(
                                      "text-xs px-1.5 py-0.5 rounded font-medium",
                                      step.priority === "critical" && "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
                                      step.priority === "high" && "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
                                      step.priority === "medium" && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
                                      step.priority === "low" && "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                    )}>
                                      {step.priority}
                                    </span>
                                  )}
                                  {step.estimatedEffort && (
                                    <span className={cn(
                                      "text-xs px-1.5 py-0.5 rounded",
                                      step.estimatedEffort === "small" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
                                      step.estimatedEffort === "medium" && "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
                                      step.estimatedEffort === "large" && "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                                    )}>
                                      {step.estimatedEffort === "small" ? "S" : step.estimatedEffort === "medium" ? "M" : "L"}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <p className="text-muted-foreground text-xs">{step.description}</p>

                              {/* Acceptance Criteria */}
                              {step.acceptanceCriteria && step.acceptanceCriteria.length > 0 && (
                                <div className="pt-2 border-t border-blue-100 dark:border-blue-800/30">
                                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Acceptance Criteria:</p>
                                  <ul className="text-xs space-y-0.5">
                                    {step.acceptanceCriteria.map((ac, j) => (
                                      <li key={j} className="flex items-start gap-1.5 text-muted-foreground">
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
                                    <span key={j} className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 font-mono">
                                      {file}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Dependencies */}
                              {step.dependencies && step.dependencies.length > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  <span className="font-medium">Depends on:</span> Task {step.dependencies.join(", ")}
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
                      <h4 className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide mb-2">⚠️ Risks & Mitigations</h4>
                      <ul className="text-sm space-y-2">
                        {plan.risks.map((risk, i) => (
                          <li key={i} className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200/50 dark:border-amber-800/30">
                            <p className="text-xs font-medium text-amber-800 dark:text-amber-200">{risk.description}</p>
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                              <span className="font-medium">Mitigation:</span> {risk.mitigation}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Definition of Done */}
                  {plan.definitionOfDone && plan.definitionOfDone.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide mb-1">✅ Definition of Done</h4>
                      <ul className="text-sm space-y-1">
                        {plan.definitionOfDone.map((d, i) => (
                          <li key={i} className="flex items-start gap-2 text-muted-foreground">
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
                      <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-1">Verification Steps</h4>
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
          {(task.status === "ready" || task.status === "executing" || task.status === "done") && task.planContent && (() => {
            const plan = parsePlanContent(task.planContent);
            const summary = calculatePlanSummary(plan);
            return (
              <details className="group" open={task.status === "ready"}>
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
                        <h4 className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide mb-1">Sprint Goal</h4>
                        <p className="text-sm font-medium">{plan.sprintGoal}</p>
                      </div>
                    </div>
                  )}

                  {/* Scope Summary */}
                  <div className="flex items-start gap-3">
                    <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide mb-1">Scope Summary</h4>
                      <p className="text-sm">
                        <span className="font-semibold">{summary.stepCount}</span> step{summary.stepCount !== 1 ? "s" : ""}
                        {summary.fileCount > 0 ? (
                          <> across <span className="font-semibold">{summary.fileCount}</span> file{summary.fileCount !== 1 ? "s" : ""}</>
                        ) : (
                          <span className="text-muted-foreground"> (files determined at execution)</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Estimated Complexity */}
                  <div className="flex items-start gap-3">
                    <Gauge className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide mb-1">Estimated Complexity</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{summary.complexity} points</span>
                        <span className={cn(
                          "px-2 py-0.5 rounded text-xs font-medium",
                          summary.complexity <= 5 && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
                          summary.complexity > 5 && summary.complexity <= 10 && "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
                          summary.complexity > 10 && "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                        )}>
                          {summary.complexity <= 5 ? "Low" : summary.complexity <= 10 ? "Medium" : "High"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Critical Steps */}
                  {summary.criticalSteps.length > 0 && (
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-semibold text-red-700 dark:text-red-300 uppercase tracking-wide mb-1">Critical Steps</h4>
                        <ul className="text-sm space-y-1">
                          {summary.criticalSteps.map((step, i) => (
                            <li key={step.id || i} className="flex items-start gap-2">
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
                        <h4 className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide mb-1">Target Branch</h4>
                        <code className="text-sm font-mono bg-amber-100 dark:bg-amber-800/40 px-2 py-0.5 rounded">{task.branch}</code>
                      </div>
                    </div>
                  )}
                </div>
              </details>
            );
          })()}

          {/* Updated timestamp */}
          {task.updatedAt && (
            <div className="text-xs text-muted-foreground">
              Last updated {formatDistanceToNow(task.updatedAt, { addSuffix: true })}
            </div>
          )}
        </div>

        {/* Footer with Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 sm:p-6 border-t bg-muted/30">
          <p className="text-sm text-muted-foreground order-2 sm:order-1">{config.description}</p>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto order-1 sm:order-2">
            {/* Action buttons based on status */}
            {task.status === "todo" && (
              <Button
                onClick={handleBrainstorm}
                disabled={loading}
                className="gap-2"
              >
                {loading && actionType === "brainstorm" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Start Brainstorming
              </Button>
            )}

            {task.status === "brainstorming" && task.brainstormResult && (
              <>
                <Button
                  variant="outline"
                  onClick={handleRefine}
                  disabled={loading}
                  className="gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Refine
                </Button>
                <Button onClick={handlePlan} disabled={loading} className="gap-2">
                  {loading && actionType === "plan" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4" />
                  )}
                  Generate Plan
                </Button>
              </>
            )}

            {task.status === "planning" && task.planContent && (
              <Button
                onClick={handleMarkReady}
                disabled={loading}
                className="gap-2"
              >
                {loading && actionType === "ready" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                Mark Ready
              </Button>
            )}

            {task.status === "ready" && (
              <Button
                onClick={handleStartExecution}
                disabled={loading}
                className="gap-2"
              >
                {loading && actionType === "execute" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Start Execution
              </Button>
            )}

            {task.status === "executing" && (
              <Button variant="secondary" disabled className="gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Executing...
              </Button>
            )}

            {task.status === "done" && (
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm font-medium">Task Completed</span>
              </div>
            )}

            {task.status === "stuck" && (
              <Button
                variant="outline"
                onClick={handleBrainstorm}
                disabled={loading}
                className="gap-2"
              >
                {loading && actionType === "brainstorm" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Retry Brainstorming
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Brainstorm Panel */}
      {showBrainstormPanel && (
        <BrainstormPanel
          taskId={task.id}
          taskTitle={task.title}
          isOpen={showBrainstormPanel}
          onClose={() => setShowBrainstormPanel(false)}
          onFinalize={handleBrainstormFinalize}
          onSave={onUpdate}
        />
      )}

      {/* Error Dialog - for errors with actions (rate limit, auth, etc.) */}
      {apiError && apiError.action && (
        <ErrorDialog
          open={!!apiError}
          onClose={clearError}
          title={apiError.code === "RATE_LIMIT" ? "Rate Limited" : "Error"}
          description={apiError.message}
          isApiKeyError={isApiKeyError}
          retryCountdown={retryCountdown}
          errorAction={apiError.action}
        />
      )}

      {/* Autonomous Mode Confirmation Dialog */}
      <ConfirmDialog
        open={showAutonomousConfirm}
        onOpenChange={setShowAutonomousConfirm}
        title="Enable Autonomous Mode?"
        description={`This task is at the "${getStatusLabel(task.status)}" stage. Enabling autonomous mode will automatically continue to the next stage${task.status === "ready" ? " and start execution immediately" : ""}.`}
        confirmLabel="Enable & Continue"
        cancelLabel="Cancel"
        onConfirm={handleConfirmAutonomous}
      />
    </div>
  );

  // Use portal to render at document body level (covers sidebar)
  if (!mounted) return null;
  return createPortal(modalContent, document.body);
}
