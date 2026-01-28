"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  GitBranch,
  Bot,
} from "lucide-react";
import type { DemoCard, Column } from "./demo-data";

// ============================================================================
// Tag Component
// ============================================================================

function Tag({
  children,
  color,
}: {
  children: React.ReactNode;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    violet:
      "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    amber:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    emerald:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    red: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  };

  return (
    <span
      className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${colorClasses[color] || colorClasses.violet}`}
    >
      {children}
    </span>
  );
}

// ============================================================================
// ProgressBar Component
// ============================================================================

function ProgressBar({
  value,
  isAnimating = false,
}: {
  value: number;
  isAnimating?: boolean;
}) {
  return (
    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
      <motion.div
        className="h-full bg-emerald-500 rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: isAnimating ? 3.5 : 0.5, ease: "easeOut" }}
      />
    </div>
  );
}

// ============================================================================
// TaskCard Component
// ============================================================================

export interface TaskCardProps {
  card: DemoCard;
  column: Column;
  isActive: boolean;
  onPause: (paused: boolean) => void;
  executingProgress?: number;
}

export function TaskCard({
  card,
  column,
  isActive,
  onPause,
  executingProgress,
}: TaskCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const [isHovered, setIsHovered] = useState(false);
  const [timeInStage, setTimeInStage] = useState(0);
  const [wasBlocked, setWasBlocked] = useState(card.isBlocked);
  const [showUnlockAnimation, setShowUnlockAnimation] = useState(false);

  // Track unlock animation
  useEffect(() => {
    if (wasBlocked && !card.isBlocked) {
      setShowUnlockAnimation(true);
      const timer = setTimeout(() => setShowUnlockAnimation(false), 1500);
      return () => clearTimeout(timer);
    }
    setWasBlocked(card.isBlocked);
  }, [card.isBlocked, wasBlocked]);

  // Track time in stage
  useEffect(() => {
    if (isActive) {
      setTimeInStage(0);
      const interval = setInterval(() => {
        setTimeInStage((t) => t + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isActive, card.status]);

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ago`;
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    onPause(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    onPause(false);
  };

  const isExecuting = card.status === "executing";
  const displayProgress =
    isExecuting && executingProgress !== undefined
      ? executingProgress
      : card.progress;

  // Status-specific indicators
  const getStatusIndicator = () => {
    if (card.isBlocked) {
      return (
        <div className="flex items-center gap-1.5">
          <Lock className="w-3 h-3 text-amber-500" />
          <span className="text-[9px] font-medium text-amber-600 dark:text-amber-400">
            Blocked
          </span>
        </div>
      );
    }

    if (showUnlockAnimation) {
      return (
        <motion.div
          className="flex items-center gap-1.5"
          initial={{ scale: 1 }}
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            initial={{ rotate: 0 }}
            animate={{ rotate: [-10, 10, 0] }}
            transition={{ duration: 0.3 }}
          >
            <Unlock className="w-3 h-3 text-emerald-500" />
          </motion.div>
          <span className="text-[9px] font-medium text-emerald-600 dark:text-emerald-400">
            Ready to start
          </span>
        </motion.div>
      );
    }

    if (card.status === "done") {
      return (
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3 h-3 text-green-500" />
          <span className="text-[9px] font-medium text-green-600 dark:text-green-400">
            Complete!
          </span>
        </div>
      );
    }

    if (card.status === "stuck") {
      return (
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3 text-red-500" />
          <span className="text-[9px] font-medium text-red-600 dark:text-red-400">
            Needs attention
          </span>
        </div>
      );
    }

    if (isActive && !["done", "stuck", "review"].includes(card.status)) {
      const statusLabels: Record<string, string> = {
        todo: "Waiting...",
        brainstorming: "Thinking...",
        planning: "Planning...",
        ready: "Queued...",
        executing: "Executing...",
      };
      return (
        <div className="flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: column.accent }}
          />
          <span
            className="text-[9px] font-medium"
            style={{ color: column.accent }}
          >
            {statusLabels[card.status] || "Processing..."}
          </span>
        </div>
      );
    }

    return null;
  };

  return (
    <motion.div
      data-card-id={card.id}
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
      animate={{
        opacity: 1,
        y: 0,
        boxShadow: isHovered
          ? "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)"
          : showUnlockAnimation
            ? "0 0 20px 5px rgba(34, 197, 94, 0.3)"
            : "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
      }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
      transition={
        shouldReduceMotion
          ? { duration: 0.1 }
          : { duration: 0.3, ease: "easeOut" }
      }
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`
        relative bg-white dark:bg-slate-800 rounded-lg border p-2.5 cursor-pointer transition-colors
        ${card.isBlocked ? "border-amber-300 dark:border-amber-700" : "border-slate-200 dark:border-slate-700"}
        ${isExecuting && !shouldReduceMotion ? "executing-gradient-border" : ""}
      `}
    >
      {/* Executing gradient border animation */}
      {isExecuting && !shouldReduceMotion && (
        <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none">
          <div className="absolute inset-[-2px] rounded-lg bg-gradient-conic from-emerald-500 via-cyan-500 to-emerald-500 animate-spin-slow opacity-60" />
          <div className="absolute inset-[1px] rounded-[6px] bg-white dark:bg-slate-800" />
        </div>
      )}

      {/* Card content - relative to stack above the gradient border overlay */}
      <div className="relative">
        {/* Accent bar */}
        <div className={`h-1 w-10 rounded-full ${column.accentLight} mb-2`} />

        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <h4 className="text-[10px] font-semibold text-slate-800 dark:text-slate-200 leading-tight line-clamp-2">
            {card.title}
          </h4>
          <div className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
            <Bot className="w-2.5 h-2.5 text-slate-500 dark:text-slate-400" />
          </div>
        </div>

        {/* Description */}
        <p className="text-[9px] text-slate-500 dark:text-slate-400 mb-1.5 leading-relaxed line-clamp-2">
          {card.description}
        </p>

        {/* Tags */}
        <div className="flex gap-1 mb-1.5 flex-wrap">
          {card.tags.map((tag) => (
            <Tag key={tag.label} color={tag.color}>
              {tag.label}
            </Tag>
          ))}
        </div>

        {/* Footer */}
        {card.branch && (
          <div className="flex items-center gap-1 text-[9px] text-slate-400 dark:text-slate-500 mb-1.5">
            <GitBranch className="w-2.5 h-2.5" />
            <span className="font-mono truncate">{card.branch}</span>
          </div>
        )}

        {/* Progress bar for executing */}
        {isExecuting && (
          <div className="mb-1.5">
            <ProgressBar value={displayProgress} isAnimating={isActive} />
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-[8px] text-emerald-600 dark:text-emerald-400 font-medium">
                Executing...
              </span>
              <span className="text-[8px] text-slate-400">
                {Math.round(displayProgress)}%
              </span>
            </div>
          </div>
        )}

        {/* Status indicator */}
        <div className="mt-1.5">{getStatusIndicator()}</div>

        {/* Time indicator for active cards */}
        {isActive &&
          !card.isBlocked &&
          !["done", "stuck"].includes(card.status) && (
            <div className="absolute top-2 right-2">
              <span className="text-[8px] text-slate-400">
                {formatTime(timeInStage)}
              </span>
            </div>
          )}
      </div>
    </motion.div>
  );
}
