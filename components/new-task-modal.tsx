"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  X,
  Plus,
  Sparkles,
  Loader2,
  AlertCircle,
  Lightbulb,
} from "lucide-react";
import type { Task } from "@/lib/db/schema";

interface NewTaskModalProps {
  repoId: string;
  onClose: () => void;
  onCreate: (task: Task) => void;
}

// Example task suggestions for placeholder cycling
const taskExamples = [
  "Add user authentication with OAuth",
  "Create a REST API for products",
  "Implement dark mode support",
  "Add unit tests for utils",
  "Set up CI/CD pipeline",
];

export function NewTaskModal({ repoId, onClose, onCreate }: NewTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/repos/${repoId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to create task");
      }

      const task = await res.json();
      onCreate(task);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Get a random example for the placeholder
  const randomExample =
    taskExamples[Math.floor(Math.random() * taskExamples.length)];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg overflow-hidden bg-card rounded-2xl shadow-2xl border animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold tracking-tight">
                New Task
              </h2>
              <p className="text-sm text-muted-foreground">
                Describe what you want to build
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 -m-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5">
            {/* Error message */}
            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200/50 dark:border-red-800/30 text-red-600 dark:text-red-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Error creating task</p>
                  <p className="text-sm opacity-80 mt-0.5">{error}</p>
                </div>
              </div>
            )}

            {/* Title field */}
            <div className="space-y-2">
              <label
                htmlFor="title"
                className="text-sm font-medium flex items-center gap-2"
              >
                Task Title
                <span className="text-red-500">*</span>
              </label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={randomExample}
                className="h-11"
                autoFocus
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Be specific about what you want to accomplish
              </p>
            </div>

            {/* Description field */}
            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                Description
                <span className="text-muted-foreground font-normal ml-1">
                  (optional)
                </span>
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add any additional context, requirements, or constraints..."
                rows={4}
                disabled={loading}
                className={cn(
                  "w-full rounded-xl border border-input bg-transparent px-4 py-3",
                  "text-sm shadow-sm placeholder:text-muted-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  "resize-none transition-colors"
                )}
              />
            </div>

            {/* AI hint */}
            <div className="flex items-start gap-3 p-4 bg-violet-50 dark:bg-violet-900/20 rounded-xl border border-violet-200/50 dark:border-violet-800/30">
              <Lightbulb className="w-5 h-5 text-violet-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-violet-700 dark:text-violet-300">
                  AI-Powered Workflow
                </p>
                <p className="text-violet-600/80 dark:text-violet-400/80 mt-0.5">
                  After creating, you can brainstorm ideas, generate a plan, and
                  let AI execute the task automatically.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 p-4 sm:p-6 border-t bg-muted/30">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || loading}
              className="gap-2 min-w-[120px] w-full sm:w-auto"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Create Task
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
