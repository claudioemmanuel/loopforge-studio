"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Lock,
  Unlock,
  Plus,
  X,
  Search,
  Zap,
  ArrowRight,
  ChevronDown,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useTaskDependencies } from "@/components/hooks/use-task-dependencies";
import type { Task, TaskStatus } from "@/lib/db/schema";

interface DependencyEditorProps {
  taskId: string;
  repoId: string;
  className?: string;
}

// Status badge colors
const statusColors: Record<TaskStatus, string> = {
  todo: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  brainstorming:
    "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  planning: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  ready: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  executing: "bg-primary/20 text-primary",
  review: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  stuck: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

function TaskBadge({ task }: { task: Task }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span
        className={cn(
          "flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-medium",
          statusColors[task.status],
        )}
      >
        {task.status}
      </span>
      <span className="truncate text-sm">{task.title}</span>
    </div>
  );
}

export function DependencyEditor({
  taskId,
  repoId,
  className,
}: DependencyEditorProps) {
  const {
    blockedBy,
    blocks,
    availableTasks,
    autoExecuteWhenUnblocked,
    isLoading,
    error,
    addDependency,
    removeDependency,
    setAutoExecuteWhenUnblocked,
  } = useTaskDependencies({ taskId, repoId });

  const [searchQuery, setSearchQuery] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Filter available tasks by search
  const filteredTasks = availableTasks.filter(
    (task) =>
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Handle adding a dependency
  const handleAddDependency = async (blockedById: string) => {
    setIsAdding(true);
    await addDependency(blockedById);
    setIsAdding(false);
    setSearchQuery("");
  };

  // Handle removing a dependency
  const handleRemoveDependency = async (blockedById: string) => {
    setRemovingId(blockedById);
    await removeDependency(blockedById);
    setRemovingId(null);
  };

  // Handle toggling auto-execute
  const handleAutoExecuteToggle = async () => {
    await setAutoExecuteWhenUnblocked(!autoExecuteWhenUnblocked);
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Loading dependencies...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn("flex items-center gap-2 py-4 text-red-500", className)}
      >
        <AlertCircle className="w-4 h-4" />
        <span className="text-sm">Failed to load dependencies</span>
      </div>
    );
  }

  const hasBlockers = blockedBy.length > 0;
  const hasDependents = blocks.length > 0;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Blocked By Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-muted-foreground" />
            <h4 className="text-sm font-medium">Blocked By</h4>
            {hasBlockers && (
              <span className="px-1.5 py-0.5 rounded-full text-xs bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                {blockedBy.length}
              </span>
            )}
          </div>

          {/* Add Dependency Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={availableTasks.length === 0}
              >
                <Plus className="w-3.5 h-3.5" />
                Add
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Add Blocker</DropdownMenuLabel>
              <div className="px-2 pb-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search tasks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-8"
                  />
                </div>
              </div>
              <DropdownMenuSeparator />
              <div className="max-h-60 overflow-y-auto">
                {filteredTasks.length === 0 ? (
                  <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                    {searchQuery ? "No matching tasks" : "No tasks available"}
                  </div>
                ) : (
                  filteredTasks.map((task) => (
                    <DropdownMenuItem
                      key={task.id}
                      onClick={() => handleAddDependency(task.id)}
                      disabled={isAdding}
                      className="cursor-pointer"
                    >
                      <TaskBadge task={task} />
                    </DropdownMenuItem>
                  ))
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Blockers List */}
        {hasBlockers ? (
          <div className="space-y-2">
            {blockedBy.map(({ dependency, task }) => (
              <div
                key={dependency.id}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border"
              >
                <TaskBadge task={task} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-red-500"
                  onClick={() => handleRemoveDependency(task.id)}
                  disabled={removingId === task.id}
                >
                  {removingId === task.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-2">
            No blockers - this task can proceed independently
          </p>
        )}
      </div>

      {/* Blocks Section */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
          <h4 className="text-sm font-medium">Blocks</h4>
          {hasDependents && (
            <span className="px-1.5 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              {blocks.length}
            </span>
          )}
        </div>

        {hasDependents ? (
          <div className="space-y-2">
            {blocks.map(({ task }) => (
              <div
                key={task.id}
                className="flex items-center p-2 rounded-lg bg-muted/30 border border-dashed"
              >
                <TaskBadge task={task} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-2">
            No tasks are waiting on this one
          </p>
        )}
      </div>

      {/* Auto-Execute Toggle */}
      <div className="pt-2 border-t">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap
              className={cn(
                "w-4 h-4",
                autoExecuteWhenUnblocked
                  ? "text-amber-500"
                  : "text-muted-foreground",
              )}
            />
            <div>
              <h4 className="text-sm font-medium">
                Auto-execute when unblocked
              </h4>
              <p className="text-xs text-muted-foreground">
                Automatically start this task when all blockers complete
              </p>
            </div>
          </div>
          <button
            onClick={handleAutoExecuteToggle}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              autoExecuteWhenUnblocked ? "bg-amber-500" : "bg-muted",
            )}
          >
            <span
              className={cn(
                "inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-white shadow-sm transition-transform",
                autoExecuteWhenUnblocked ? "translate-x-5" : "translate-x-0.5",
              )}
            >
              {autoExecuteWhenUnblocked ? (
                <Unlock className="w-3 h-3 text-amber-500" />
              ) : (
                <Lock className="w-3 h-3 text-muted-foreground" />
              )}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
