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

type TranslationFunction = (key: string) => string;

/**
 * Canonical status configuration factory for all 8 task statuses.
 *
 * This is the single source of truth for status icons, labels, colors,
 * and descriptions. Component-specific styling (Tailwind classes, etc.)
 * should be defined locally in each component.
 *
 * @param t - Translation function from useTranslations hook
 * @returns Status configuration with translated labels and descriptions
 */
export function getStatusConfig(
  t: TranslationFunction,
): Record<TaskStatus, BaseStatusConfig> {
  return {
    todo: {
      icon: Clock,
      label: t("tasks.statuses.todo"),
      accentColor: "slate",
      description: t("tasks.statusDescriptions.todo"),
    },
    brainstorming: {
      icon: Lightbulb,
      label: t("tasks.statuses.brainstorming"),
      accentColor: "violet",
      description: t("tasks.statusDescriptions.brainstorming"),
    },
    planning: {
      icon: FileText,
      label: t("tasks.statuses.planning"),
      accentColor: "blue",
      description: t("tasks.statusDescriptions.planning"),
    },
    ready: {
      icon: Zap,
      label: t("tasks.statuses.ready"),
      accentColor: "amber",
      description: t("tasks.statusDescriptions.ready"),
    },
    executing: {
      icon: Play,
      label: t("tasks.statuses.executing"),
      accentColor: "primary",
      description: t("tasks.statusDescriptions.executing"),
    },
    review: {
      icon: Eye,
      label: t("tasks.statuses.review"),
      accentColor: "cyan",
      description: t("tasks.statusDescriptions.review"),
    },
    done: {
      icon: CheckCircle2,
      label: t("tasks.statuses.done"),
      accentColor: "emerald",
      description: t("tasks.statusDescriptions.done"),
    },
    stuck: {
      icon: AlertTriangle,
      label: t("tasks.statuses.stuck"),
      accentColor: "red",
      description: t("tasks.statusDescriptions.stuck"),
    },
  };
}
