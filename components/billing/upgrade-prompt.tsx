"use client";

import { AlertTriangle, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface UpgradePromptProps {
  type: "task" | "execution" | "repo";
  currentUsage?: number;
  limit?: number;
  className?: string;
}

const messages = {
  task: {
    title: "Task Limit Reached",
    description: "You've reached your monthly task limit.",
    cta: "Upgrade to create more tasks",
  },
  execution: {
    title: "Token Limit Reached",
    description: "You've used all your tokens for this billing period.",
    cta: "Upgrade for more tokens",
  },
  repo: {
    title: "Repository Limit Reached",
    description: "You've connected the maximum number of repositories.",
    cta: "Upgrade for unlimited repos",
  },
};

export function UpgradePrompt({
  type,
  currentUsage,
  limit,
  className,
}: UpgradePromptProps) {
  const message = messages[type];

  return (
    <div
      className={cn(
        "p-4 rounded-lg border border-yellow-500/50 bg-yellow-500/10",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-yellow-500">{message.title}</h4>
          <p className="text-sm text-muted-foreground mt-1">
            {message.description}
            {currentUsage !== undefined && limit !== undefined && (
              <span className="font-mono ml-1">
                ({currentUsage}/{limit})
              </span>
            )}
          </p>
          <Link href="/subscription">
            <Button variant="outline" size="sm" className="mt-3">
              <Sparkles className="w-4 h-4 mr-2" />
              {message.cta}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

interface LimitWarningProps {
  type: "task" | "execution" | "repo";
  percentUsed: number;
  className?: string;
}

export function LimitWarning({
  type,
  percentUsed,
  className,
}: LimitWarningProps) {
  if (percentUsed < 80) return null;

  const isAtLimit = percentUsed >= 100;

  const warningMessages = {
    task: isAtLimit
      ? "You've reached your task limit"
      : "You're approaching your task limit",
    execution: isAtLimit
      ? "You've used all your tokens"
      : "You're running low on tokens",
    repo: isAtLimit
      ? "You've reached your repo limit"
      : "You're approaching your repo limit",
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm",
        isAtLimit
          ? "bg-destructive/10 text-destructive border border-destructive/30"
          : "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30",
        className,
      )}
    >
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      <span>{warningMessages[type]}</span>
      <Link
        href="/subscription"
        className="ml-auto font-medium hover:underline flex items-center gap-1"
      >
        Upgrade <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}
