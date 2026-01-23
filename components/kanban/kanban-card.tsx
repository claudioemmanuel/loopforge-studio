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
  Trash2,
  Loader2,
  Bot,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ProcessingPopover, phaseConfig } from "./processing-popover";
import type { Task, TaskStatus } from "@/lib/db/schema";
import type { CardProcessingState } from "@/components/hooks/use-card-processing";
import { formatDistanceToNow } from "date-fns";

interface KanbanCardProps {
  task: Task;
  onClick: () => void;
  onDelete?: (taskId: string) => void;
  onMove?: (taskId: string, newStatus: TaskStatus) => void;
  onStart?: (taskId: string) => Promise<void>;
  onAdvance?: (taskId: string, action: "plan" | "ready" | "execute") => Promise<void>;
  isDragOverlay?: boolean;
  processingState?: CardProcessingState;
  isSliding?: boolean;
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
  },
  planning: {
    icon: FileText,
    color: "text-blue-500 dark:text-blue-400",
    textColor: "text-blue-600 dark:text-blue-300",
    bgColor: "bg-blue-100/80 dark:bg-blue-900/40",
    borderColor: "border-blue-200/80 dark:border-blue-700/50",
    glowColor: "shadow-blue-500/20",
    label: "Planning",
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
    label: "Failed",
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

export function KanbanCard({ task, onClick, onDelete, onMove, onStart, onAdvance, isDragOverlay, processingState, isSliding }: KanbanCardProps) {
  const [starting, setStarting] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Check if card is currently processing
  const isProcessing = !!processingState;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: isProcessing });

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

  const handleAdvance = async (e: React.MouseEvent, action: "plan" | "ready" | "execute") => {
    e.stopPropagation();
    if (!onAdvance || advancing) return;
    setAdvancing(true);
    try {
      await onAdvance(task.id, action);
    } finally {
      setAdvancing(false);
    }
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || "transform 200ms cubic-bezier(0.25, 1, 0.5, 1), box-shadow 200ms ease, opacity 150ms ease",
  };

  const config = statusConfig[task.status];
  const StatusIcon = config.icon;
  const progress = isProcessing ? processingState.progress : getProgressPercentage(task.status);
  const showProgress = !["stuck", "done", "todo"].includes(task.status) || isProcessing;

  // Show gradient border for executing tasks (but not during drag overlay)
  const showGradientBorder = task.status === "executing" && !isDragOverlay && !isProcessing;

  // Get processing phase config for ring color
  const processingConfig = isProcessing ? phaseConfig[processingState.processingPhase] : null;

  // Card classes (shared between wrapped and unwrapped versions)
  const cardClasses = cn(
    // Base layout
    "group relative flex flex-col",
    // Card styling - clean, minimal approach
    "bg-card border",
    "transition-all duration-200 ease-out",
    // Default state
    "border-border/60 shadow-sm",
    // Hover effects - subtle lift (disabled when processing)
    !isProcessing && "hover:shadow-md hover:border-border hover:-translate-y-0.5",
    // Cursor - grab cursor for entire card (pointer when processing)
    isProcessing ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
    "select-none",
    // Dragging states
    isDragging && "opacity-50 scale-[0.98] shadow-none cursor-grabbing",
    // Drag overlay - floating appearance
    isDragOverlay && [
      "shadow-2xl scale-105 -rotate-1",
      "ring-2 ring-primary/20 ring-offset-2 ring-offset-background",
      "border-primary/30",
    ],
    // Processing state - ring styling by phase
    isProcessing && processingConfig && [
      "ring-2 ring-offset-2 ring-offset-background",
      processingState.processingPhase === "brainstorming" && "ring-violet-500/50",
      processingState.processingPhase === "planning" && "ring-blue-500/50",
      processingState.processingPhase === "executing" && "ring-emerald-500/50",
    ],
    // Slide animation when moving between lanes
    isSliding && "animate-slide-to-lane",
    // Rounded corners - slightly smaller when wrapped to fit inside gradient border
    showGradientBorder ? "rounded-[10px]" : "rounded-xl"
  );

  // Card content (shared between both render paths)
  const cardContent = (
    <>
      {/* Processing overlay */}
      {isProcessing && (
        <div className="absolute inset-0 z-10 bg-background/80 backdrop-blur-[2px] rounded-xl flex flex-col items-center justify-center gap-2 p-4">
          <Loader2 className={cn(
            "w-6 h-6 animate-spin",
            processingState.processingPhase === "brainstorming" && "text-violet-500",
            processingState.processingPhase === "planning" && "text-blue-500",
            processingState.processingPhase === "executing" && "text-emerald-500",
          )} />
          <span className="text-xs font-medium text-muted-foreground text-center">
            {processingState.statusText}
          </span>
          <div className="w-full max-w-[120px] h-1 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300 ease-out",
                processingState.processingPhase === "brainstorming" && "bg-violet-500",
                processingState.processingPhase === "planning" && "bg-blue-500",
                processingState.processingPhase === "executing" && "bg-emerald-500",
              )}
              style={{ width: `${processingState.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Drag handle indicator - visible on mobile, appears on hover on desktop */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center",
          "sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-150",
          "rounded-l-xl hover:bg-muted/50 pointer-events-none",
          isProcessing && "hidden" // Hide drag handle when processing
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
                  "sm:opacity-0 sm:group-hover:opacity-100",
                  "hover:bg-muted/50 text-muted-foreground hover:text-foreground",
                  "transition-all duration-150"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {onDelete && (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(true);
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

            {/* Autonomous mode indicator */}
            {task.autonomousMode && (
              <div
                className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100/80 dark:bg-amber-900/40 rounded-full text-xs text-amber-700 dark:text-amber-300 font-medium"
                title="Autonomous mode enabled"
              >
                <Bot className="w-3 h-3" />
                <span>Auto</span>
              </div>
            )}

            {/* Branch name */}
            {task.branch && (
              <div className="inline-flex items-center gap-1 px-2 py-1 bg-muted/70 rounded-full text-xs text-muted-foreground font-mono">
                <GitBranch className="w-3 h-3" />
                <span className="truncate max-w-[80px]">{task.branch}</span>
              </div>
            )}
          </div>

          {/* Action buttons for each phase - visible on mobile, hover on desktop */}
          {/* Disable (not hide) buttons when autonomous mode is active */}
          {task.status !== "executing" && task.status !== "done" && (
            <>
              {task.status === "todo" && onStart && (
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 px-3 text-xs gap-1.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                  onClick={handleStart}
                  disabled={starting || task.autonomousMode}
                  title={task.autonomousMode ? "Autonomous mode active" : undefined}
                >
                  {starting ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  {starting ? "Starting..." : "Start"}
                </Button>
              )}
              {task.status === "brainstorming" && (
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 px-3 text-xs gap-1.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                  onClick={(e) => handleAdvance(e, "plan")}
                  disabled={advancing || task.autonomousMode}
                  title={task.autonomousMode ? "Autonomous mode active" : undefined}
                >
                  {advancing ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <FileText className="w-3 h-3" />
                  )}
                  {advancing ? "Planning..." : "Plan"}
                </Button>
              )}
              {task.status === "planning" && (
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 px-3 text-xs gap-1.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                  onClick={(e) => handleAdvance(e, "ready")}
                  disabled={advancing || task.autonomousMode}
                  title={task.autonomousMode ? "Autonomous mode active" : undefined}
                >
                  {advancing ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Zap className="w-3 h-3" />
                  )}
                  {advancing ? "Setting..." : "Ready"}
                </Button>
              )}
              {task.status === "ready" && onAdvance && (
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 px-3 text-xs gap-1.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                  onClick={(e) => handleAdvance(e, "execute")}
                  disabled={advancing || task.autonomousMode}
                  title={task.autonomousMode ? "Autonomous mode active" : undefined}
                >
                  {advancing ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Play className="w-3 h-3" />
                  )}
                  {advancing ? "Starting..." : "Execute"}
                </Button>
              )}
            </>
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

      {/* Delete confirmation dialog - wrapped to prevent click propagation to card */}
      {onDelete && (
        <div onClick={(e) => e.stopPropagation()}>
          <ConfirmDialog
            open={showDeleteConfirm}
            onOpenChange={setShowDeleteConfirm}
            title="Delete Task?"
            description={`Are you sure you want to delete "${task.title}"? This action cannot be undone.`}
            confirmLabel="Delete"
            cancelLabel="Cancel"
            onConfirm={() => onDelete(task.id)}
            variant="destructive"
          />
        </div>
      )}
    </>
  );

  // Base card element (without processing popover wrapper)
  const baseCard = showGradientBorder ? (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "relative p-[2px] rounded-xl",
        isProcessing ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
        "select-none",
        isDragging && "opacity-50 scale-[0.98]",
        isSliding && "animate-slide-to-lane"
      )}
    >
      {/* Rotating gradient background */}
      <div className="absolute inset-0 rounded-xl overflow-hidden">
        <div
          className="absolute inset-[-100%] animate-gradient-rotate"
          style={{
            background: "conic-gradient(from 0deg, #22c55e, #14b8a6, #06b6d4, #22c55e)",
          }}
        />
      </div>

      {/* Card content */}
      <div onClick={isProcessing ? undefined : onClick} className={cn(cardClasses, "relative")}>
        {cardContent}
      </div>
    </div>
  ) : (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={isProcessing ? undefined : onClick}
      className={cardClasses}
    >
      {cardContent}
    </div>
  );

  // Wrap with processing popover when processing
  if (isProcessing) {
    return (
      <ProcessingPopover processingState={processingState}>
        {baseCard}
      </ProcessingPopover>
    );
  }

  return baseCard;
}
