"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  X,
  Zap,
  GitBranch,
  Calendar,
  AlertTriangle,
  Pencil,
} from "lucide-react";
import { format } from "date-fns";
import type { Task } from "@/lib/db/schema";
import { getStatusConfigForModal } from "./task-config";

interface TaskHeaderProps {
  task: Task;
  autonomousMode: boolean;
  togglingAutonomous: boolean;
  onToggleAutonomous: () => void;
  onClose: () => void;
  onTitleSave?: (title: string) => Promise<void>;
}

export function TaskHeader({
  task,
  autonomousMode,
  togglingAutonomous,
  onToggleAutonomous,
  onClose,
  onTitleSave,
}: TaskHeaderProps) {
  const t = useTranslations();
  const statusConfig = getStatusConfigForModal(t);
  const config = statusConfig[task.status];
  const StatusIcon = config.icon;
  const isEditable = task.status === "todo" || task.status === "stuck";
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(task.title);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitleValue(task.title);
  }, [task.title]);

  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editingTitle]);

  const handleTitleSave = async () => {
    const trimmed = titleValue.trim();
    if (trimmed && trimmed !== task.title && onTitleSave) {
      await onTitleSave(trimmed);
    }
    setEditingTitle(false);
  };

  return (
    <div className="border-b">
      <div className="flex items-start justify-between p-6 pb-4">
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            {editingTitle ? (
              <input
                ref={titleInputRef}
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleTitleSave();
                  if (e.key === "Escape") {
                    setTitleValue(task.title);
                    setEditingTitle(false);
                  }
                }}
                className="text-xl font-serif font-bold tracking-tight bg-transparent border-b-2 border-primary outline-none w-full"
              />
            ) : (
              <h2
                className={cn(
                  "text-xl font-serif font-bold tracking-tight",
                  isEditable &&
                    "cursor-pointer hover:text-primary/80 group/title",
                )}
                onClick={() => isEditable && setEditingTitle(true)}
                title={isEditable ? "Click to edit title" : undefined}
              >
                {task.title}
                {isEditable && (
                  <Pencil className="inline-block w-3.5 h-3.5 ml-2 opacity-0 group-hover/title:opacity-50 transition-opacity" />
                )}
              </h2>
            )}
            {/* Autonomous Mode Toggle */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={onToggleAutonomous}
                disabled={
                  togglingAutonomous ||
                  task.status === "executing" ||
                  task.status === "done"
                }
                role="switch"
                aria-checked={autonomousMode}
                aria-label="Toggle autonomous mode"
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  autonomousMode ? "bg-amber-500" : "bg-muted",
                )}
                title="When enabled, this task will progress automatically through all stages without manual approval"
              >
                <span
                  className={cn(
                    "inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-white shadow-sm transition-transform",
                    autonomousMode ? "translate-x-5" : "translate-x-0.5",
                  )}
                >
                  <Zap
                    className={cn(
                      "w-3 h-3",
                      autonomousMode
                        ? "text-amber-500"
                        : "text-muted-foreground",
                    )}
                  />
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
                config.color,
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
            <span className="font-medium">Autonomous Mode enabled.</span> This
            task will progress automatically through all stages without manual
            approval.
          </p>
        </div>
      )}
    </div>
  );
}
