import {
  Clock,
  Lightbulb,
  FileText,
  Zap,
  Play,
  CheckCircle2,
  AlertTriangle,
  Eye,
} from "lucide-react";
import type { TaskStatus } from "@/lib/db/schema";

// Status configuration shared across task modal sub-components
export const statusConfig: Record<
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
  review: {
    icon: Eye,
    label: "Review",
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "bg-cyan-100 dark:bg-cyan-900/40",
    description: "Changes ready for review",
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
    label: "Failed",
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/40",
    description: "Needs attention",
  },
};

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
