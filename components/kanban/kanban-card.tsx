"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  GitBranch,
  Lightbulb,
  FileText,
  Zap,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MoreHorizontal,
  GripVertical,
  Sparkles,
  Pencil,
  Trash2,
  ArrowRight,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Task, TaskStatus } from "@/lib/db/schema";
import { formatDistanceToNow } from "date-fns";

interface KanbanCardProps {
  task: Task;
  onClick: () => void;
  onDelete?: (taskId: string) => void;
  onMove?: (taskId: string, newStatus: TaskStatus) => void;
  onStart?: (taskId: string) => Promise<void>;
  isDragOverlay?: boolean;
}

// Status configuration with icons, colors, and visual treatments
const statusConfig: Record<
  TaskStatus,
  {
    icon: typeof Lightbulb;
    color: string;
    textColor: string;
    bgColor: string;
    borderColor: string;
    glowColor: string;
    label: string;
    isActive?: boolean;
  }
> = {
  todo: {
    icon: Clock,
    color: "text-slate-500 dark:text-slate-400",
    textColor: "text-slate-600 dark:text-slate-300",
    bgColor: "bg-slate-100/80 dark:bg-slate-800/60",
    borderColor: "border-slate-200/80 dark:border-slate-700/60",
    glowColor: "",
    label: "To Do",
  },
  brainstorming: {
    icon: Lightbulb,
    color: "text-violet-500 dark:text-violet-400",
    textColor: "text-violet-600 dark:text-violet-300",
    bgColor: "bg-violet-100/80 dark:bg-violet-900/40",
    borderColor: "border-violet-200/80 dark:border-violet-700/50",
    glowColor: "shadow-violet-500/20",
    label: "Brainstorming",
    isActive: true,
  },
  planning: {
    icon: FileText,
    color: "text-blue-500 dark:text-blue-400",
    textColor: "text-blue-600 dark:text-blue-300",
    bgColor: "bg-blue-100/80 dark:bg-blue-900/40",
    borderColor: "border-blue-200/80 dark:border-blue-700/50",
    glowColor: "shadow-blue-500/20",
    label: "Planning",
    isActive: true,
  },
  ready: {
    icon: Zap,
    color: "text-amber-500 dark:text-amber-400",
    textColor: "text-amber-600 dark:text-amber-300",
    bgColor: "bg-amber-100/80 dark:bg-amber-900/40",
    borderColor: "border-amber-200/80 dark:border-amber-700/50",
    glowColor: "",
    label: "Ready",
  },
  executing: {
    icon: Play,
    color: "text-primary",
    textColor: "text-primary",
    bgColor: "bg-primary/10 dark:bg-primary/20",
    borderColor: "border-primary/30 dark:border-primary/40",
    glowColor: "shadow-primary/25",
    label: "Executing",
    isActive: true,
  },
  done: {
    icon: CheckCircle2,
    color: "text-emerald-500 dark:text-emerald-400",
    textColor: "text-emerald-600 dark:text-emerald-300",
    bgColor: "bg-emerald-100/80 dark:bg-emerald-900/40",
    borderColor: "border-emerald-200/80 dark:border-emerald-700/50",
    glowColor: "",
    label: "Done",
  },
  stuck: {
    icon: AlertTriangle,
    color: "text-red-500 dark:text-red-400",
    textColor: "text-red-600 dark:text-red-300",
    bgColor: "bg-red-100/80 dark:bg-red-900/40",
    borderColor: "border-red-200/80 dark:border-red-700/50",
    glowColor: "shadow-red-500/20",
    label: "Stuck",
  },
};

// Progress indicator based on task state
function getProgressPercentage(status: TaskStatus): number {
  const progressMap: Record<TaskStatus, number> = {
    todo: 0,
    brainstorming: 20,
    planning: 40,
    ready: 60,
    executing: 80,
    done: 100,
    stuck: 0,
  };
  return progressMap[status];
}

const allStatuses: { status: TaskStatus; label: string }[] = [
  { status: "todo", label: "To Do" },
  { status: "brainstorming", label: "Brainstorming" },
  { status: "planning", label: "Planning" },
  { status: "ready", label: "Ready" },
  { status: "executing", label: "Executing" },
  { status: "done", label: "Done" },
  { status: "stuck", label: "Stuck" },
];

export function KanbanCard({ task, onClick, onDelete, onMove, onStart, isDragOverlay }: KanbanCardProps) {
  const [starting, setStarting] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const handleStart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onStart || starting) return;
    setStarting(true);
    try {
      await onStart(task.id);
    } finally {
      setStarting(false);
    }
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || "transform 200ms cubic-bezier(0.25, 1, 0.5, 1), box-shadow 200ms ease, opacity 150ms ease",
  };

  const config = statusConfig[task.status];
  const StatusIcon = config.icon;
  const progress = getProgressPercentage(task.status);
  const showProgress = !["stuck", "done", "todo"].includes(task.status);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      onClick={onClick}
      className={cn(
        // Base layout
        "group relative flex flex-col",
        // Card styling - clean, minimal approach
        "bg-card rounded-xl border",
        "transition-all duration-200 ease-out",
        // Default state
        "border-border/60 shadow-sm",
        // Hover effects - subtle lift
        "hover:shadow-md hover:border-border hover:-translate-y-0.5",
        // Cursor
        "cursor-pointer select-none",
        // Active task glow effect
        config.isActive && config.glowColor && "shadow-lg",
        // Dragging states
        isDragging && "opacity-50 scale-[0.98] shadow-none",
        // Drag overlay - floating appearance
        isDragOverlay && [
          "shadow-2xl scale-105 -rotate-1",
          "ring-2 ring-primary/20 ring-offset-2 ring-offset-background",
          "border-primary/30",
        ]
      )}
    >
      {/* Drag handle - appears on hover */}
      <div
        {...listeners}
        className={cn(
          "absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center",
          "opacity-0 group-hover:opacity-100 transition-opacity duration-150",
          "cursor-grab active:cursor-grabbing",
          "rounded-l-xl hover:bg-muted/50"
        )}
      >
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/60" />
      </div>

      {/* Card content */}
      <div className="p-4 pl-4 group-hover:pl-6 transition-all duration-200">
        {/* Header with title and quick actions */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <h4 className="font-medium text-sm leading-snug line-clamp-2 text-foreground group-hover:text-primary transition-colors duration-200">
            {task.title}
          </h4>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex-shrink-0 p-1.5 -m-1 rounded-lg",
                  "opacity-0 group-hover:opacity-100",
                  "hover:bg-muted/50 text-muted-foreground hover:text-foreground",
                  "transition-all duration-150"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onClick(); }}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit Task
              </DropdownMenuItem>
              {onMove && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Move to
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {allStatuses
                      .filter((s) => s.status !== task.status)
                      .map((s) => (
                        <DropdownMenuItem
                          key={s.status}
                          onClick={(e) => {
                            e.stopPropagation();
                            onMove(task.id, s.status);
                          }}
                        >
                          {s.label}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              <DropdownMenuSeparator />
              {onDelete && (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(task.id);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Task
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Description preview */}
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
            {task.description}
          </p>
        )}

        {/* Metadata row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status badge */}
            <div
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full",
                "text-xs font-medium",
                config.bgColor,
                config.textColor,
                "transition-colors duration-200"
              )}
            >
              <StatusIcon
                className={cn(
                  "w-3 h-3",
                  config.isActive && "animate-pulse"
                )}
              />
              <span>{config.label}</span>
            </div>

            {/* Branch name */}
            {task.branch && (
              <div className="inline-flex items-center gap-1 px-2 py-1 bg-muted/70 rounded-full text-xs text-muted-foreground font-mono">
                <GitBranch className="w-3 h-3" />
                <span className="truncate max-w-[80px]">{task.branch}</span>
              </div>
            )}
          </div>

          {/* Start button for todo tasks */}
          {task.status === "todo" && onStart && (
            <Button
              size="sm"
              variant="default"
              className="h-7 px-3 text-xs gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleStart}
              disabled={starting}
            >
              {starting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              {starting ? "Starting..." : "Start"}
            </Button>
          )}
        </div>

        {/* Progress bar for active tasks */}
        {showProgress && (
          <div className="mt-3 pt-3 border-t border-border/40">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground font-medium">Progress</span>
              <span className={cn("font-semibold tabular-nums", config.textColor)}>
                {progress}%
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500 ease-out",
                  task.status === "executing"
                    ? "bg-primary"
                    : task.status === "brainstorming"
                    ? "bg-violet-500"
                    : task.status === "planning"
                    ? "bg-blue-500"
                    : "bg-amber-500"
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Timestamp for completed/stuck tasks */}
        {(task.status === "done" || task.status === "stuck") && task.updatedAt && (
          <div className="mt-3 pt-3 border-t border-border/40 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{formatDistanceToNow(task.updatedAt, { addSuffix: true })}</span>
          </div>
        )}
      </div>

      {/* Active task indicator - subtle pulsing dot */}
      {config.isActive && (
        <div className="absolute top-3 right-3">
          <span className="relative flex h-2 w-2">
            <span
              className={cn(
                "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                task.status === "executing"
                  ? "bg-primary"
                  : task.status === "brainstorming"
                  ? "bg-violet-400"
                  : "bg-blue-400"
              )}
            />
            <span
              className={cn(
                "relative inline-flex rounded-full h-2 w-2",
                task.status === "executing"
                  ? "bg-primary"
                  : task.status === "brainstorming"
                  ? "bg-violet-500"
                  : "bg-blue-500"
              )}
            />
          </span>
        </div>
      )}

      {/* AI indicator for brainstorming/planning tasks */}
      {(task.status === "brainstorming" || task.status === "planning") && (
        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className={cn(
            "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
            config.bgColor,
            config.textColor
          )}>
            <Sparkles className="w-2.5 h-2.5" />
            <span>AI</span>
          </div>
        </div>
      )}
    </div>
  );
}
