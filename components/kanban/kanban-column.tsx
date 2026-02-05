"use client";

import React from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { KanbanCard } from "./kanban-card";
import {
  FileText,
  Zap,
  Play,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Sparkles,
  CircleDashed,
  Eye,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Task, TaskStatus } from "@/lib/db/schema";
import type { CardProcessingState } from "@/components/hooks/use-card-processing";
import { STATUS_CONFIG } from "@/components/status-config";

interface KanbanColumnProps {
  id: TaskStatus;
  title: string;
  tasks: Task[];
  allTasks?: Task[];
  onTaskClick: (task: Task) => void;
  onTaskDelete?: (taskId: string) => void;
  onTaskMove?: (taskId: string, newStatus: TaskStatus) => void;
  onTaskStart?: (taskId: string) => Promise<void>;
  onTaskAdvance?: (
    taskId: string,
    action: "plan" | "ready" | "execute",
  ) => Promise<void>;
  onAddTask?: () => void;
  processingCards?: Map<string, CardProcessingState>;
  slidingCards?: Set<string>;
}

// Column-specific visual configuration (Tailwind classes).
// The column icon is derived from STATUS_CONFIG; empty state text comes from translations.
interface ColumnStyle {
  color: string;
  bgColor: string;
  headerBg: string;
  borderColor: string;
  dropTargetBg: string;
  emptyIcon: LucideIcon;
}

const columnStyles: Record<TaskStatus, ColumnStyle> = {
  todo: {
    color: "text-slate-600 dark:text-slate-400",
    bgColor: "bg-slate-50/30 dark:bg-slate-900/20",
    headerBg: "bg-slate-100/80 dark:bg-slate-800/40",
    borderColor: "border-slate-200/60 dark:border-slate-700/40",
    dropTargetBg: "bg-slate-100 dark:bg-slate-800",
    emptyIcon: CircleDashed,
  },
  brainstorming: {
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-50/30 dark:bg-violet-900/10",
    headerBg: "bg-violet-100/80 dark:bg-violet-900/30",
    borderColor: "border-violet-200/60 dark:border-violet-800/40",
    dropTargetBg: "bg-violet-100 dark:bg-violet-900/40",
    emptyIcon: Sparkles,
  },
  planning: {
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50/30 dark:bg-blue-900/10",
    headerBg: "bg-blue-100/80 dark:bg-blue-900/30",
    borderColor: "border-blue-200/60 dark:border-blue-800/40",
    dropTargetBg: "bg-blue-100 dark:bg-blue-900/40",
    emptyIcon: FileText,
  },
  ready: {
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50/30 dark:bg-amber-900/10",
    headerBg: "bg-amber-100/80 dark:bg-amber-900/30",
    borderColor: "border-amber-200/60 dark:border-amber-800/40",
    dropTargetBg: "bg-amber-100 dark:bg-amber-900/40",
    emptyIcon: Zap,
  },
  executing: {
    color: "text-primary",
    bgColor: "bg-primary/5 dark:bg-primary/10",
    headerBg: "bg-primary/10 dark:bg-primary/15",
    borderColor: "border-primary/20 dark:border-primary/30",
    dropTargetBg: "bg-primary/10 dark:bg-primary/20",
    emptyIcon: Play,
  },
  review: {
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "bg-cyan-50/30 dark:bg-cyan-900/10",
    headerBg: "bg-cyan-100/80 dark:bg-cyan-900/30",
    borderColor: "border-cyan-200/60 dark:border-cyan-800/40",
    dropTargetBg: "bg-cyan-100 dark:bg-cyan-900/40",
    emptyIcon: Eye,
  },
  done: {
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50/30 dark:bg-emerald-900/10",
    headerBg: "bg-emerald-100/80 dark:bg-emerald-900/30",
    borderColor: "border-emerald-200/60 dark:border-emerald-800/40",
    dropTargetBg: "bg-emerald-100 dark:bg-emerald-900/40",
    emptyIcon: CheckCircle2,
  },
  stuck: {
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50/30 dark:bg-red-900/10",
    headerBg: "bg-red-100/80 dark:bg-red-900/30",
    borderColor: "border-red-200/60 dark:border-red-800/40",
    dropTargetBg: "bg-red-100 dark:bg-red-900/40",
    emptyIcon: AlertTriangle,
  },
};

// Merged config: shared icon + column-specific styling
function getColumnConfig(status: TaskStatus) {
  const base = STATUS_CONFIG[status];
  const style = columnStyles[status];
  return { icon: base.icon, accentColor: base.accentColor, ...style };
}

export const KanbanColumn = React.memo(function KanbanColumn({
  id,
  title,
  tasks,
  allTasks,
  onTaskClick,
  onTaskDelete,
  onTaskMove,
  onTaskStart,
  onTaskAdvance,
  onAddTask,
  processingCards,
  slidingCards,
}: KanbanColumnProps) {
  const { setNodeRef, isOver, active } = useDroppable({ id });
  const config = getColumnConfig(id);
  const Icon = config.icon;
  const EmptyIcon = config.emptyIcon;
  const t = useTranslations("kanban");

  const isDropTarget = isOver && active?.id !== id;
  const taskCount = tasks.length;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        // Base layout - fixed widths for horizontal scrolling, h-full for consistent column heights
        "flex flex-col h-full w-[280px] min-w-[280px] md:w-[300px] md:min-w-[300px] rounded-2xl",
        // Background - clean, subtle
        config.bgColor,
        // Border
        "border",
        config.borderColor,
        // Drop target animation
        isDropTarget && [
          "ring-2 ring-primary/40 ring-offset-2 ring-offset-background",
          "scale-[1.01]",
          config.dropTargetBg,
        ],
        // Smooth transitions
        "transition-all duration-200 ease-out",
      )}
    >
      {/* Column Header */}
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3.5",
          "rounded-t-2xl",
          config.headerBg,
        )}
      >
        {/* Icon container */}
        <div
          className={cn(
            "flex items-center justify-center w-8 h-8",
            "rounded-xl bg-background/80 shadow-sm",
            "ring-1 ring-border/50",
          )}
        >
          <Icon className={cn("w-4 h-4", config.color)} />
        </div>

        {/* Title and count */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <h3 className="font-serif font-semibold text-sm tracking-tight">
            {title}
          </h3>
          <div
            className={cn(
              "flex items-center justify-center min-w-[22px] h-[22px] px-1.5",
              "rounded-full text-xs font-semibold tabular-nums",
              "bg-background/80 shadow-sm ring-1 ring-border/50",
              taskCount > 0 ? config.color : "text-muted-foreground",
            )}
          >
            {taskCount}
          </div>
        </div>

        {/* Add task button (only for todo column or can be extended) */}
        {id === "todo" && onAddTask && (
          <button
            onClick={onAddTask}
            className={cn(
              "flex items-center justify-center w-7 h-7",
              "rounded-lg hover:bg-background/80",
              "text-muted-foreground hover:text-foreground",
              "transition-colors duration-150",
            )}
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Scrollable Task List */}
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          className={cn(
            "flex-1 overflow-y-auto p-3 space-y-2.5",
            "min-h-[180px] max-h-[calc(100vh-280px)]",
            "h-full",
            // Custom scrollbar styling
            "scrollbar-thin scrollbar-thumb-border/50 scrollbar-track-transparent",
          )}
        >
          {tasks.length === 0 ? (
            // Empty State - clean and inviting, fills space for better drop target
            <div
              className={cn(
                "flex flex-col items-center justify-center h-full min-h-[180px] px-4",
                "text-center",
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center w-14 h-14 mb-4",
                  "rounded-2xl bg-muted/50",
                  "ring-1 ring-border/30",
                )}
              >
                <EmptyIcon
                  className={cn("w-6 h-6", "text-muted-foreground/50")}
                />
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                {t(`emptyStates.${id}.message`)}
              </p>
              <p className="text-xs text-muted-foreground/70 max-w-[180px]">
                {t(`emptyStates.${id}.hint`)}
              </p>

              {/* Drop zone indicator when empty and dragging */}
              {isDropTarget && (
                <div
                  className={cn(
                    "mt-4 w-full h-24 rounded-xl",
                    "border-2 border-dashed border-primary/40",
                    "bg-primary/5 animate-pulse",
                    "flex items-center justify-center",
                  )}
                >
                  <span className="text-xs text-primary/60 font-medium">
                    {t("dropHere")}
                  </span>
                </div>
              )}
            </div>
          ) : (
            // Task Cards
            <>
              {tasks.map((task) => (
                <KanbanCard
                  key={task.id}
                  task={task}
                  allTasks={allTasks}
                  onClick={() => onTaskClick(task)}
                  onDelete={onTaskDelete}
                  onMove={onTaskMove}
                  onStart={onTaskStart}
                  onAdvance={onTaskAdvance}
                  processingState={processingCards?.get(task.id)}
                  isSliding={slidingCards?.has(task.id)}
                />
              ))}

              {/* Drop indicator when dragging over populated column */}
              {isDropTarget && (
                <div
                  className={cn(
                    "h-20 rounded-xl",
                    "border-2 border-dashed border-primary/40",
                    "bg-primary/5 animate-pulse",
                    "flex items-center justify-center",
                  )}
                >
                  <span className="text-xs text-primary/60 font-medium">
                    {t("dropHere")}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </SortableContext>

      {/* Column Footer - Add task for todo column */}
      {id === "todo" && (
        <div className="p-3 pt-0">
          <button
            onClick={onAddTask}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-2.5 px-3",
              "rounded-xl border border-dashed",
              "border-border/60 hover:border-primary/40",
              "bg-background/30 hover:bg-background/60",
              "text-sm text-muted-foreground hover:text-foreground",
              "transition-all duration-200",
            )}
          >
            <Plus className="w-4 h-4" />
            <span>{t("addTask")}</span>
          </button>
        </div>
      )}
    </div>
  );
});
