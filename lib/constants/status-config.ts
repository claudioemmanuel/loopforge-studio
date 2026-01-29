import type { LucideIcon } from "lucide-react";
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

/**
 * Base status configuration shared across all components that display task status.
 *
 * Components may extend this with additional component-specific properties
 * (e.g. Tailwind classes for card styling, column backgrounds, etc.).
 */
export interface BaseStatusConfig {
  /** Lucide icon component for this status */
  icon: LucideIcon;
  /** Human-readable label (e.g. "To Do", "Brainstorming") */
  label: string;
  /** Base accent color name used for theming (e.g. "slate", "violet", "blue") */
  accentColor: string;
  /** Short description of what this status means */
  description: string;
}

/**
 * Canonical status configuration for all 8 task statuses.
 *
 * This is the single source of truth for status icons, labels, colors,
 * and descriptions. Component-specific styling (Tailwind classes, etc.)
 * should be defined locally in each component.
 */
export const STATUS_CONFIG: Record<TaskStatus, BaseStatusConfig> = {
  todo: {
    icon: Clock,
    label: "To Do",
    accentColor: "slate",
    description: "Waiting to start",
  },
  brainstorming: {
    icon: Lightbulb,
    label: "Brainstorming",
    accentColor: "violet",
    description: "AI generating ideas",
  },
  planning: {
    icon: FileText,
    label: "Planning",
    accentColor: "blue",
    description: "Creating execution plan",
  },
  ready: {
    icon: Zap,
    label: "Ready",
    accentColor: "amber",
    description: "Ready to execute",
  },
  executing: {
    icon: Play,
    label: "Executing",
    accentColor: "primary",
    description: "AI working on code",
  },
  review: {
    icon: Eye,
    label: "Review",
    accentColor: "cyan",
    description: "Changes ready for review",
  },
  done: {
    icon: CheckCircle2,
    label: "Done",
    accentColor: "emerald",
    description: "Task completed",
  },
  stuck: {
    icon: AlertTriangle,
    label: "Failed",
    accentColor: "red",
    description: "Needs attention",
  },
};

/**
 * Get status configuration for a given task status.
 * Provides a convenient accessor with type safety.
 */
export function getStatusConfig(status: TaskStatus): BaseStatusConfig {
  return STATUS_CONFIG[status];
}
