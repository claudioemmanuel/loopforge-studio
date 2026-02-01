"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  TestTube,
  Bug,
  CheckCircle,
  Lightbulb,
  FileText,
  Sparkles,
  Code,
  Users,
  GitBranch,
  Database,
  Zap,
} from "lucide-react";

type SkillStatus = "passed" | "warning" | "blocked";

interface SkillBadgeProps {
  skillId: string;
  status: SkillStatus;
  message?: string;
  compact?: boolean;
}

const SKILL_CONFIG: Record<
  string,
  {
    name: string;
    icon: React.ComponentType<{ className?: string }>;
    color: {
      passed: string;
      warning: string;
      blocked: string;
    };
  }
> = {
  "test-driven-development": {
    name: "TDD",
    icon: TestTube,
    color: {
      passed:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      warning:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      blocked: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    },
  },
  "systematic-debugging": {
    name: "Debug",
    icon: Bug,
    color: {
      passed:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      warning:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      blocked: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    },
  },
  "verification-before-completion": {
    name: "Verify",
    icon: CheckCircle,
    color: {
      passed:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      warning:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      blocked: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    },
  },
  brainstorming: {
    name: "Brainstorm",
    icon: Lightbulb,
    color: {
      passed:
        "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      warning:
        "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      blocked:
        "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    },
  },
  "writing-plans": {
    name: "Plan",
    icon: FileText,
    color: {
      passed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      warning:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      blocked: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    },
  },
  "using-superpowers": {
    name: "Skills",
    icon: Sparkles,
    color: {
      passed:
        "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
      warning:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      blocked: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    },
  },
  "autonomous-code-generation": {
    name: "AutoGen",
    icon: Code,
    color: {
      passed: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
      warning:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      blocked: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    },
  },
  "multi-agent-coordination": {
    name: "Multi-Agent",
    icon: Users,
    color: {
      passed: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
      warning:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      blocked: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    },
  },
  "git-workflow-automation": {
    name: "Git",
    icon: GitBranch,
    color: {
      passed:
        "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      warning:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      blocked: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    },
  },
  "context-accumulation": {
    name: "Context",
    icon: Database,
    color: {
      passed:
        "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200",
      warning:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      blocked: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    },
  },
  "prompt-engineering": {
    name: "Prompts",
    icon: Zap,
    color: {
      passed:
        "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
      warning:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      blocked: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    },
  },
};

const STATUS_SYMBOLS = {
  passed: "✓",
  warning: "⚠",
  blocked: "✗",
};

export function SkillBadge({
  skillId,
  status,
  message,
  compact = false,
}: SkillBadgeProps) {
  const config = SKILL_CONFIG[skillId];

  if (!config) {
    return null;
  }

  const Icon = config.icon;
  const colorClass = config.color[status];
  const statusSymbol = STATUS_SYMBOLS[status];

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={`${colorClass} flex items-center gap-1 text-xs px-1.5 py-0.5 border-0 flex-shrink-0`}
            >
              <Icon className="h-3 w-3 flex-shrink-0" />
              <span className="text-xs">{statusSymbol}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-1">
              <div className="font-semibold">{config.name}</div>
              <div className="text-sm text-muted-foreground capitalize">
                Status: {status}
              </div>
              {message && (
                <div className="text-xs text-muted-foreground">{message}</div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`${colorClass} flex items-center gap-1.5 text-xs px-2 py-1 border-0 flex-shrink-0`}
          >
            <Icon className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="font-medium">{config.name}</span>
            <span className="text-xs ml-0.5">{statusSymbol}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm">
          <div className="space-y-1">
            <div className="font-semibold">{config.name}</div>
            <div className="text-sm text-muted-foreground capitalize">
              Status: {status}
            </div>
            {message && (
              <div className="text-xs text-muted-foreground mt-2">
                {message}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Display multiple skill badges in a compact row
 */
export function SkillBadgeGroup({
  skills,
  compact = true,
}: {
  skills: Array<{
    skillId: string;
    status: SkillStatus;
    message?: string;
  }>;
  compact?: boolean;
}) {
  if (skills.length === 0) {
    return null;
  }

  // Limit to 3 badges to prevent overflow, show +N indicator for remaining
  const MAX_VISIBLE = 3;
  const visibleSkills = skills.slice(0, MAX_VISIBLE);
  const remainingCount = skills.length - MAX_VISIBLE;

  return (
    <div className="flex flex-wrap gap-1 flex-shrink-0">
      {visibleSkills.map((skill) => (
        <SkillBadge
          key={skill.skillId}
          skillId={skill.skillId}
          status={skill.status}
          message={skill.message}
          compact={compact}
        />
      ))}
      {remainingCount > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className="bg-muted text-muted-foreground flex items-center gap-1 text-xs px-1.5 py-0.5 border-0 flex-shrink-0"
              >
                +{remainingCount}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top">
              <div className="text-xs">
                {remainingCount} more skill{remainingCount > 1 ? "s" : ""}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
