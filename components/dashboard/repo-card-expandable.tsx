"use client";

import Link from "next/link";
import { ArrowRight, Lock, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/db/schema";

interface RepoCardExpandableProps {
  repo: {
    id: string;
    name: string;
    fullName: string;
    defaultBranch: string;
    isPrivate: boolean;
  };
  tasks: Task[];
  isNew?: boolean;
}

export function RepoCardExpandable({ repo, tasks, isNew }: RepoCardExpandableProps) {
  const activeTasks = tasks.filter(t =>
    t.status === "executing" || t.status === "brainstorming" || t.status === "planning"
  ).length;

  return (
    <Link
      href={`/repos/${repo.id}`}
      className={cn(
        "block rounded-xl border bg-card p-4 transition-all duration-200",
        "hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5",
        "cursor-pointer group"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold truncate group-hover:text-primary transition-colors">
              {repo.name}
            </span>
            {isNew && (
              <span className="px-1.5 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded">
                NEW
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate">{repo.fullName}</p>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{tasks.length} tasks</span>
          {activeTasks > 0 && (
            <span className="text-blue-600 dark:text-blue-400">
              {activeTasks} active
            </span>
          )}
          <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
            {repo.defaultBranch}
          </span>
          {repo.isPrivate ? (
            <Lock className="w-4 h-4" />
          ) : (
            <Globe className="w-4 h-4" />
          )}
          <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </Link>
  );
}
