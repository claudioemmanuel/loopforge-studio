import type { LucideIcon } from "lucide-react";
import type { TaskStatus } from "@/lib/db/schema";
import { getStatusConfig } from "@/components/status-config";

type TranslationFunction = (key: string) => string;

// Extended status configuration for task modal sub-components
// Derives icon, label, description from the shared getStatusConfig
// and adds component-specific Tailwind classes.
export function getStatusConfigForModal(t: TranslationFunction): Record<
  TaskStatus,
  {
    icon: LucideIcon;
    label: string;
    color: string;
    bgColor: string;
    description: string;
  }
> {
  const baseConfig = getStatusConfig(t);
  return Object.fromEntries(
    (Object.keys(baseConfig) as TaskStatus[]).map((status) => {
      const base = baseConfig[status];
      return [
        status,
        {
          icon: base.icon,
          label: base.label,
          description: base.description,
          ...getModalColors(status),
        },
      ];
    }),
  ) as Record<
    TaskStatus,
    {
      icon: LucideIcon;
      label: string;
      color: string;
      bgColor: string;
      description: string;
    }
  >;
}

/**
 * Legacy export for backwards compatibility.
 * @deprecated Use getStatusConfigForModal(t) instead
 */
export const statusConfig = getStatusConfigForModal((key: string) => key);

// Component-specific color mappings for the task modal
function getModalColors(status: TaskStatus): {
  color: string;
  bgColor: string;
} {
  switch (status) {
    case "todo":
      return {
        color: "text-slate-600 dark:text-slate-400",
        bgColor: "bg-slate-100 dark:bg-slate-800",
      };
    case "brainstorming":
      return {
        color: "text-violet-600 dark:text-violet-400",
        bgColor: "bg-violet-100 dark:bg-violet-900/40",
      };
    case "planning":
      return {
        color: "text-blue-600 dark:text-blue-400",
        bgColor: "bg-blue-100 dark:bg-blue-900/40",
      };
    case "ready":
      return {
        color: "text-amber-600 dark:text-amber-400",
        bgColor: "bg-amber-100 dark:bg-amber-900/40",
      };
    case "executing":
      return {
        color: "text-primary",
        bgColor: "bg-primary/10",
      };
    case "review":
      return {
        color: "text-cyan-600 dark:text-cyan-400",
        bgColor: "bg-cyan-100 dark:bg-cyan-900/40",
      };
    case "done":
      return {
        color: "text-emerald-600 dark:text-emerald-400",
        bgColor: "bg-emerald-100 dark:bg-emerald-900/40",
      };
    case "stuck":
      return {
        color: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-100 dark:bg-red-900/40",
      };
  }
}

// Workflow steps for progress indicator
export const workflowSteps: TaskStatus[] = [
  "todo",
  "brainstorming",
  "planning",
  "ready",
  "executing",
  "review",
  "done",
];
