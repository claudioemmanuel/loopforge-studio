"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  GitBranch,
  FileText,
  Zap,
  Play,
  Clock,
  MoreHorizontal,
  GripVertical,
  Sparkles,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ProcessingPopover, phaseConfig } from "./processing-popover";
import { useDependencyHighlight } from "./dependency-highlight-context";
import { useKanbanFocus } from "./kanban-focus-context";
import {
  CardStatusBadge,
  getCardConfig,
  getProgressPercentage,
} from "./card-status-badge";
import { CardProcessingOverlay } from "./card-processing-overlay";
import { SkillBadgeGroup } from "./skill-badge";
import { RecoveryStatusBadge } from "./recovery-status-badge";
import { RecoveryPopover } from "./recovery-popover";
import type { RecoveryStatus } from "./recovery-status-badge";
import type { Task, TaskStatus } from "@/lib/db/schema";
import type { CardProcessingState } from "@/components/hooks/use-card-processing";
import { formatDistanceToNow } from "date-fns";

interface KanbanCardProps {
  task: Task;
  allTasks?: Task[];
  onClick: () => void;
  onDelete?: (taskId: string) => void;
  onMove?: (taskId: string, newStatus: TaskStatus) => void;
  onStart?: (taskId: string) => Promise<void>;
  onAdvance?: (
    taskId: string,
    action: "plan" | "ready" | "execute",
  ) => Promise<void>;
  isDragOverlay?: boolean;
  processingState?: CardProcessingState;
  isSliding?: boolean;
}

export const KanbanCard = React.memo(function KanbanCard({
  task,
  allTasks,
  onClick,
  onDelete,
  onMove: _onMove,
  onStart,
  onAdvance,
  isDragOverlay,
  processingState,
  isSliding,
}: KanbanCardProps) {
  const t = useTranslations();
  const [starting, setStarting] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [recoveryStatus, setRecoveryStatus] = useState<RecoveryStatus>({
    isRecovering: false,
    currentTier: null,
    attemptNumber: 0,
    maxAttempts: 3,
    progress: 0,
    status: "idle",
  });
  const [recoveryElapsedTime, setRecoveryElapsedTime] = useState(0);
  const [recoveryError, setRecoveryError] = useState<string>();

  // Fetch recovery status when task is stuck or recovering
  useEffect(() => {
    if (
      task.status === "stuck" ||
      task.processingPhase === "recovering"
    ) {
      const fetchRecoveryStatus = async () => {
        try {
          const res = await fetch(`/api/tasks/${task.id}/recovery-status`);
          if (res.ok) {
            const data = await res.json();
            setRecoveryStatus({
              isRecovering: data.isRecovering,
              currentTier: data.currentTier,
              attemptNumber: data.attemptNumber,
              maxAttempts: data.maxAttempts,
              progress: data.progress,
              status: data.status,
            });
            setRecoveryElapsedTime(data.elapsedTime || 0);
            setRecoveryError(data.lastError);
          }
        } catch (error) {
          console.error("Failed to fetch recovery status:", error);
        }
      };

      fetchRecoveryStatus();
      // Poll every 2 seconds while recovering
      const interval = setInterval(fetchRecoveryStatus, 2000);
      return () => clearInterval(interval);
    }
  }, [task.id, task.status, task.processingPhase]);

  // Dependency highlight context
  const dependencyContext = useDependencyHighlight();
  const { setHoveredTask, isBlocker, isBlocked, isUnrelated, hoveredTaskId } =
    dependencyContext;

  // Focus management
  const focusContext = useKanbanFocus();
  const cardRef = useRef<HTMLDivElement>(null);
  const isFocused = focusContext.focusedTaskId === task.id;

  useEffect(() => {
    const el = cardRef.current;
    if (el) {
      focusContext.registerCard(task.id, el);
    }
    return () => {
      focusContext.unregisterCard(task.id);
    };
  }, [task.id, focusContext]);

  // Check if card is currently processing
  const isProcessing = !!processingState;

  // Check if task has incomplete blockers (for drag lock)
  const blockedByIds = (task.blockedByIds as string[]) || [];
  const hasIncompleteBlockers =
    blockedByIds.length > 0 &&
    allTasks?.some((t) => blockedByIds.includes(t.id) && t.status !== "done");

  // Hover handlers for dependency highlighting
  const handleMouseEnter = useCallback(() => {
    if (!isDragOverlay && allTasks) {
      setHoveredTask(task.id, task, allTasks);
    }
  }, [task, allTasks, isDragOverlay, setHoveredTask]);

  const handleMouseLeave = useCallback(() => {
    if (!isDragOverlay) {
      setHoveredTask(null);
    }
  }, [isDragOverlay, setHoveredTask]);

  // Calculate highlight styles based on dependency relationships
  const isHovered = hoveredTaskId === task.id;
  const isBlockerOfHovered = isBlocker(task.id);
  const isBlockedByHovered = isBlocked(task.id);
  const isUnrelatedToHovered = isUnrelated(task.id);

  // Disable drag for processing tasks or tasks with incomplete blockers
  const isDragDisabled = isProcessing || hasIncompleteBlockers;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: isDragDisabled });

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

  const handleAdvance = async (
    e: React.MouseEvent,
    action: "plan" | "ready" | "execute",
  ) => {
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
    transition:
      transition ||
      "transform 200ms cubic-bezier(0.25, 1, 0.5, 1), box-shadow 200ms ease, opacity 150ms ease",
  };

  const config = getCardConfig(task.status);
  const progress = isProcessing
    ? processingState.progress
    : getProgressPercentage(task.status);
  const showProgress =
    !["stuck", "done", "todo"].includes(task.status) || isProcessing;

  // Show gradient border for executing tasks (but not during drag overlay)
  const showGradientBorder =
    task.status === "executing" && !isDragOverlay && !isProcessing;

  // Get processing phase config for ring color
  const processingConfig = isProcessing
    ? phaseConfig[processingState.processingPhase]
    : null;

  // Card classes (shared between wrapped and unwrapped versions)
  const cardClasses = cn(
    // Base layout
    "group relative flex flex-col",
    // Card styling - clean, minimal approach
    "bg-card border",
    "transition-all duration-200 ease-out",
    // Default state
    "border-border/60 shadow-sm",
    // Hover effects - subtle lift (disabled when processing or blocked)
    !isProcessing &&
      !hasIncompleteBlockers &&
      "hover:shadow-md hover:border-border hover:-translate-y-0.5",
    // Cursor
    isProcessing
      ? "cursor-pointer"
      : hasIncompleteBlockers
        ? "cursor-not-allowed"
        : "cursor-grab active:cursor-grabbing",
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
    isProcessing &&
      processingConfig && [
        "ring-2 ring-offset-2 ring-offset-background",
        processingState.processingPhase === "brainstorming" &&
          "ring-violet-500/50",
        processingState.processingPhase === "planning" && "ring-blue-500/50",
        processingState.processingPhase === "executing" &&
          "ring-emerald-500/50",
        processingState.processingPhase === "recovering" &&
          "ring-amber-500/50 motion-safe:animate-pulse",
      ],
    // Dependency highlight styles
    !isDragOverlay && [
      isBlockerOfHovered &&
        "ring-2 ring-amber-500/60 ring-offset-2 ring-offset-background shadow-amber-500/20 shadow-lg",
      isBlockedByHovered &&
        "ring-2 ring-red-500/60 ring-offset-2 ring-offset-background shadow-red-500/20 shadow-lg",
      isUnrelatedToHovered && "opacity-50",
      isHovered &&
        hoveredTaskId &&
        "ring-2 ring-primary/60 ring-offset-2 ring-offset-background",
    ],
    // Blocked task muted appearance
    hasIncompleteBlockers && !isHovered && "opacity-75",
    // Keyboard focus ring
    isFocused && "ring-2 ring-primary ring-offset-2 ring-offset-background",
    // Slide animation when moving between lanes
    isSliding && "animate-slide-to-lane",
    // Rounded corners
    showGradientBorder ? "rounded-[10px]" : "rounded-xl",
  );

  // Card content (shared between both render paths)
  const cardContent = (
    <>
      {/* Processing overlay */}
      {isProcessing && (
        <CardProcessingOverlay processingState={processingState} />
      )}

      {/* Drag handle indicator */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center",
          "sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-150",
          "rounded-l-xl hover:bg-muted/50 pointer-events-none",
          isProcessing && "hidden",
        )}
      >
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/60" />
      </div>

      {/* Card content */}
      <div className="p-4 pl-4 group-hover:pl-6 transition-all duration-200 overflow-x-hidden relative">
        {/* Action button - positioned absolutely to prevent layout shift */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Task actions"
              className={cn(
                "absolute top-2 right-2 z-10",
                "p-1.5 rounded-lg",
                "sm:opacity-0 sm:group-hover:opacity-100",
                "hover:bg-muted/50 text-muted-foreground hover:text-foreground",
                "transition-opacity duration-150",
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
                {t("tasks.modal.deleteTask")}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Header with title */}
        <div className="mb-2 pr-8">
          <h4 className="font-medium text-sm leading-snug line-clamp-2 text-foreground group-hover:text-primary transition-colors duration-200">
            {task.title}
          </h4>
        </div>

        {/* Description preview */}
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
            {task.description}
          </p>
        )}

        {/* Metadata row */}
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {/* Status badge, autonomous indicator, blocker badge */}
          <CardStatusBadge task={task} allTasks={allTasks} />

          {/* Recovery status badge */}
          {(task.status === "stuck" || task.processingPhase === "recovering") && (
            <RecoveryStatusBadge status={recoveryStatus} compact={true} />
          )}

          {/* Skill badges - show active skills for this task */}
          {processingState?.activeSkills &&
            processingState.activeSkills.length > 0 && (
              <SkillBadgeGroup
                skills={processingState.activeSkills}
                compact={true}
              />
            )}

          {/* Branch name */}
          {task.branch && (
            <div className="inline-flex items-center gap-1 px-2 py-1 bg-muted/70 rounded-full text-xs text-muted-foreground font-mono flex-shrink-0">
              <GitBranch className="w-3 h-3 flex-shrink-0" />
              <span className="truncate max-w-[80px]">{task.branch}</span>
            </div>
          )}

          {/* Action buttons for each phase */}
          {task.status !== "executing" && task.status !== "done" && (
            <>
              {task.status === "todo" && onStart && (
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 px-3 text-xs gap-1.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                  onClick={handleStart}
                  disabled={starting || task.autonomousMode}
                  title={
                    task.autonomousMode
                      ? t("tasks.modal.autonomousModeActive")
                      : undefined
                  }
                >
                  {starting ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  {starting ? t("tasks.modal.starting") : t("kanban.start")}
                </Button>
              )}
              {task.status === "brainstorming" && (
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 px-3 text-xs gap-1.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                  onClick={(e) => handleAdvance(e, "plan")}
                  disabled={advancing || task.autonomousMode}
                  title={
                    task.autonomousMode
                      ? t("tasks.modal.autonomousModeActive")
                      : undefined
                  }
                >
                  {advancing ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <FileText className="w-3 h-3" />
                  )}
                  {advancing ? t("tasks.modal.planning") : t("kanban.plan")}
                </Button>
              )}
              {task.status === "planning" && (
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 px-3 text-xs gap-1.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                  onClick={(e) => handleAdvance(e, "ready")}
                  disabled={advancing || task.autonomousMode}
                  title={
                    task.autonomousMode
                      ? t("tasks.modal.autonomousModeActive")
                      : undefined
                  }
                >
                  {advancing ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Zap className="w-3 h-3" />
                  )}
                  {advancing ? t("kanban.setting") : t("kanban.ready")}
                </Button>
              )}
              {task.status === "ready" && onAdvance && (
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 px-3 text-xs gap-1.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                  onClick={(e) => handleAdvance(e, "execute")}
                  disabled={advancing || task.autonomousMode}
                  title={
                    task.autonomousMode
                      ? t("tasks.modal.autonomousModeActive")
                      : undefined
                  }
                >
                  {advancing ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Play className="w-3 h-3" />
                  )}
                  {advancing ? t("tasks.modal.starting") : t("kanban.execute")}
                </Button>
              )}
            </>
          )}
        </div>

        {/* Progress bar for active tasks */}
        {showProgress && (
          <div className="mt-3 pt-3 border-t border-border/40">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground font-medium">
                {t("tasks.modal.progress")}
              </span>
              <span
                className={cn("font-semibold tabular-nums", config.textColor)}
              >
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
                        : "bg-amber-500",
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Timestamp for completed/stuck tasks */}
        {(task.status === "done" || task.status === "stuck") &&
          task.updatedAt && (
            <div className="mt-3 pt-3 border-t border-border/40 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>
                {formatDistanceToNow(task.updatedAt, { addSuffix: true })}
              </span>
            </div>
          )}
      </div>

      {/* Delete confirmation dialog */}
      {onDelete && (
        <div onClick={(e) => e.stopPropagation()}>
          <ConfirmDialog
            open={showDeleteConfirm}
            onOpenChange={setShowDeleteConfirm}
            title={t("tasks.modal.deleteTask")}
            description={t("tasks.modal.deleteConfirm", { title: task.title })}
            confirmLabel={t("tasks.modal.delete")}
            cancelLabel={t("common.cancel")}
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
      ref={(node) => {
        setNodeRef(node);
        (cardRef as React.MutableRefObject<HTMLDivElement | null>).current =
          node;
      }}
      style={style}
      data-task-id={task.id}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...attributes}
      {...listeners}
      tabIndex={0}
      onFocus={() => focusContext.setFocusedTaskId(task.id)}
      className={cn(
        "relative p-[2px] rounded-xl",
        isProcessing
          ? "cursor-pointer"
          : hasIncompleteBlockers
            ? "cursor-not-allowed"
            : "cursor-grab active:cursor-grabbing",
        "select-none",
        isDragging && "opacity-50 scale-[0.98]",
        isSliding && "animate-slide-to-lane",
      )}
    >
      {/* Rotating gradient background */}
      <div className="absolute inset-0 rounded-xl overflow-hidden">
        <div
          className="absolute inset-[-100%] animate-gradient-rotate"
          style={{
            background:
              "conic-gradient(from 0deg, #22c55e, #14b8a6, #06b6d4, #22c55e)",
          }}
        />
      </div>

      {/* Card content */}
      <div
        onClick={isProcessing ? undefined : onClick}
        className={cn(cardClasses, "relative")}
      >
        {cardContent}
      </div>
    </div>
  ) : (
    <div
      ref={(node) => {
        setNodeRef(node);
        (cardRef as React.MutableRefObject<HTMLDivElement | null>).current =
          node;
      }}
      style={style}
      data-task-id={task.id}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...attributes}
      {...listeners}
      tabIndex={0}
      onFocus={() => focusContext.setFocusedTaskId(task.id)}
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

  // Wrap with recovery popover when recovering or stuck
  if (
    (task.status === "stuck" || task.processingPhase === "recovering") &&
    recoveryStatus.status !== "idle"
  ) {
    return (
      <RecoveryPopover
        status={recoveryStatus}
        elapsedTime={recoveryElapsedTime}
        lastError={recoveryError}
      >
        {baseCard}
      </RecoveryPopover>
    );
  }

  return baseCard;
});
