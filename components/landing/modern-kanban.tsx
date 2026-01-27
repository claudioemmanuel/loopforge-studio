"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Clock,
  Lightbulb,
  FileText,
  Zap,
  Play,
  CheckCircle2,
  GitBranch,
  Bot,
} from "lucide-react";

// Stage configuration with colors
const stages = [
  {
    key: "todo",
    label: "Todo",
    description: "Tasks waiting to be picked up by the AI agent",
    Icon: Clock,
    lightBg: "bg-slate-100",
    lightBorder: "border-slate-200",
    lightText: "text-slate-600",
    darkBg: "dark:bg-slate-800/50",
    darkBorder: "dark:border-slate-700",
    darkText: "dark:text-slate-400",
    accent: "#64748b",
    accentLight: "bg-slate-500",
  },
  {
    key: "brainstorm",
    label: "Brainstorm",
    description:
      "AI explores ideas, asks clarifying questions, and refines requirements",
    Icon: Lightbulb,
    lightBg: "bg-violet-50",
    lightBorder: "border-violet-200",
    lightText: "text-violet-600",
    darkBg: "dark:bg-violet-900/20",
    darkBorder: "dark:border-violet-800",
    darkText: "dark:text-violet-400",
    accent: "#8b5cf6",
    accentLight: "bg-violet-500",
  },
  {
    key: "plan",
    label: "Plan",
    description:
      "AI creates a detailed implementation plan with steps and file changes",
    Icon: FileText,
    lightBg: "bg-blue-50",
    lightBorder: "border-blue-200",
    lightText: "text-blue-600",
    darkBg: "dark:bg-blue-900/20",
    darkBorder: "dark:border-blue-800",
    darkText: "dark:text-blue-400",
    accent: "#3b82f6",
    accentLight: "bg-blue-500",
  },
  {
    key: "ready",
    label: "Ready",
    description: "Plan approved and queued for autonomous execution",
    Icon: Zap,
    lightBg: "bg-amber-50",
    lightBorder: "border-amber-200",
    lightText: "text-amber-600",
    darkBg: "dark:bg-amber-900/20",
    darkBorder: "dark:border-amber-800",
    darkText: "dark:text-amber-400",
    accent: "#f59e0b",
    accentLight: "bg-amber-500",
  },
  {
    key: "execute",
    label: "Execute",
    description:
      "AI writes code, runs tests, and commits changes automatically",
    Icon: Play,
    lightBg: "bg-emerald-50",
    lightBorder: "border-emerald-200",
    lightText: "text-emerald-600",
    darkBg: "dark:bg-emerald-900/20",
    darkBorder: "dark:border-emerald-800",
    darkText: "dark:text-emerald-400",
    accent: "#10b981",
    accentLight: "bg-emerald-500",
  },
  {
    key: "done",
    label: "Done",
    description: "Task completed successfully with all changes committed",
    Icon: CheckCircle2,
    lightBg: "bg-green-50",
    lightBorder: "border-green-200",
    lightText: "text-green-600",
    darkBg: "dark:bg-green-900/20",
    darkBorder: "dark:border-green-800",
    darkText: "dark:text-green-400",
    accent: "#22c55e",
    accentLight: "bg-green-500",
  },
] as const;

// Stage durations in ms
const stageDurations = [2500, 2500, 2500, 2500, 3500, 2500];

// Tag component
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
  };

  return (
    <span
      className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${colorClasses[color] || colorClasses.violet}`}
    >
      {children}
    </span>
  );
}

// Progress bar component
function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
      <motion.div
        className="h-full bg-emerald-500 rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
    </div>
  );
}

// Stage popover component
function StagePopover({ stage }: { stage: (typeof stages)[number] }) {
  const Icon = stage.Icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -5 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -5 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50"
    >
      <div
        className="relative px-4 py-3 rounded-lg shadow-lg max-w-[250px] text-white"
        style={{ backgroundColor: stage.accent }}
      >
        {/* Arrow pointing up */}
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 w-0 h-0"
          style={{
            borderLeft: "8px solid transparent",
            borderRight: "8px solid transparent",
            borderBottom: `8px solid ${stage.accent}`,
          }}
        />

        {/* Header */}
        <div className="flex items-center gap-2 mb-1.5">
          <Icon className="w-4 h-4" />
          <span className="font-semibold text-sm">{stage.label}</span>
        </div>

        {/* Description */}
        <p className="text-xs leading-relaxed opacity-90">
          {stage.description}
        </p>
      </div>
    </motion.div>
  );
}

// Task card component
function TaskCard({
  stage,
  stageIndex,
  isActive,
  onPause,
}: {
  stage: (typeof stages)[number];
  stageIndex: number;
  isActive: boolean;
  onPause: (paused: boolean) => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const [progress, setProgress] = useState(0);
  const [timeInStage, setTimeInStage] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Animate progress for execute stage
  useEffect(() => {
    if (stageIndex === 4 && isActive) {
      setProgress(0);
      const interval = setInterval(() => {
        setProgress((p) => Math.min(p + 2, 85));
      }, 100);
      return () => clearInterval(interval);
    }
  }, [stageIndex, isActive]);

  // Track time in stage
  useEffect(() => {
    if (isActive) {
      setTimeInStage(0);
      const interval = setInterval(() => {
        setTimeInStage((t) => t + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isActive]);

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

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
      animate={{
        opacity: 1,
        y: 0,
        boxShadow: isHovered
          ? "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)"
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
      className="relative bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3 cursor-pointer transition-colors"
    >
      {/* Popover */}
      <AnimatePresence>
        {isHovered && <StagePopover stage={stage} />}
      </AnimatePresence>
      {/* Accent bar */}
      <div className={`h-1 w-12 rounded-full ${stage.accentLight} mb-2`} />

      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">
          Add user authentication
        </h4>
        <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
          <Bot className="w-3 h-3 text-slate-500 dark:text-slate-400" />
        </div>
      </div>

      {/* Description */}
      <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">
        Implement OAuth2 login with GitHub provider
      </p>

      {/* Tags */}
      <div className="flex gap-1 mb-2">
        <Tag color="violet">feature</Tag>
        <Tag color="amber">priority</Tag>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
        <div className="flex items-center gap-1">
          <GitBranch className="w-3 h-3" />
          <span className="font-mono">feat/auth</span>
        </div>
        <span>{formatTime(timeInStage)}</span>
      </div>

      {/* Progress bar for execute stage */}
      {stageIndex === 4 && isActive && (
        <div className="mt-2">
          <ProgressBar value={progress} />
          <div className="flex items-center justify-between mt-1">
            <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium">
              Executing...
            </span>
            <span className="text-[9px] text-slate-400">{progress}%</span>
          </div>
        </div>
      )}

      {/* Status badge for other active stages */}
      {isActive && stageIndex !== 4 && stageIndex !== 5 && (
        <div className="mt-2 flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: stage.accent }}
          />
          <span
            className="text-[9px] font-medium"
            style={{ color: stage.accent }}
          >
            {stage.label === "Todo" && "Waiting..."}
            {stage.label === "Brainstorm" && "Thinking..."}
            {stage.label === "Plan" && "Planning..."}
            {stage.label === "Ready" && "Queued..."}
          </span>
        </div>
      )}

      {/* Completed badge */}
      {stageIndex === 5 && isActive && (
        <div className="mt-2 flex items-center gap-1.5">
          <CheckCircle2 className="w-3 h-3 text-green-500" />
          <span className="text-[9px] font-medium text-green-600 dark:text-green-400">
            Complete!
          </span>
        </div>
      )}
    </motion.div>
  );
}

// Column component
function KanbanColumn({
  stage,
  stageIndex,
  isActive,
  showCard,
  onPause,
}: {
  stage: (typeof stages)[number];
  stageIndex: number;
  isActive: boolean;
  showCard: boolean;
  onPause: (paused: boolean) => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const Icon = stage.Icon;

  return (
    <motion.div
      className={`
        flex-1 min-w-0 rounded-lg border p-3
        ${stage.lightBg} ${stage.lightBorder}
        ${stage.darkBg} ${stage.darkBorder}
        transition-all duration-300
        ${isActive ? "ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900" : ""}
      `}
      style={
        isActive
          ? ({ "--tw-ring-color": stage.accent } as React.CSSProperties)
          : {}
      }
      animate={
        isActive && !shouldReduceMotion
          ? {
              boxShadow: [
                `0 0 0 0 ${stage.accent}20`,
                `0 0 0 4px ${stage.accent}10`,
                `0 0 0 0 ${stage.accent}20`,
              ],
            }
          : {}
      }
      transition={
        isActive && !shouldReduceMotion
          ? { boxShadow: { duration: 2, repeat: Infinity } }
          : {}
      }
    >
      {/* Column header */}
      <div className="flex items-center gap-1.5 mb-2 px-1">
        <motion.div
          animate={
            isActive && !shouldReduceMotion ? { rotate: [0, 10, -10, 0] } : {}
          }
          transition={
            isActive ? { duration: 0.5, repeat: Infinity, repeatDelay: 2 } : {}
          }
        >
          <Icon
            className={`w-3.5 h-3.5 ${stage.lightText} ${stage.darkText}`}
          />
        </motion.div>
        <span
          className={`text-[10px] font-semibold ${stage.lightText} ${stage.darkText}`}
        >
          {stage.label}
        </span>
        <span
          className={`ml-auto text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-white/60 dark:bg-slate-800/60 ${stage.lightText} ${stage.darkText}`}
        >
          {showCard ? 1 : 0}
        </span>
      </div>

      {/* Column body - fixed height to prevent layout shift */}
      <div className="h-[400px] overflow-visible">
        <AnimatePresence mode="wait">
          {showCard && (
            <TaskCard
              key={`card-${stage.key}`}
              stage={stage}
              stageIndex={stageIndex}
              isActive={isActive}
              onPause={onPause}
            />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// Transition trail SVG component
function TransitionTrail({
  fromIndex,
  toIndex,
  isAnimating,
  containerWidth,
}: {
  fromIndex: number;
  toIndex: number;
  isAnimating: boolean;
  containerWidth: number;
}) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion || !isAnimating || fromIndex === toIndex) return null;

  const padding = 24; // p-6 = 24px
  const gap = 12; // gap-3 = 12px
  const totalGaps = 5 * gap;
  const columnWidth = (containerWidth - padding * 2 - totalGaps) / 6;
  const startX = padding + fromIndex * (columnWidth + gap) + columnWidth / 2;
  const endX = padding + toIndex * (columnWidth + gap) + columnWidth / 2;
  const y = 100;

  const fromColor = stages[fromIndex].accent;
  const toColor = stages[toIndex].accent;

  return (
    <svg
      className="absolute top-0 left-0 w-full h-full pointer-events-none z-20"
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id="trailGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={fromColor} />
          <stop offset="100%" stopColor={toColor} />
        </linearGradient>
      </defs>
      <motion.line
        x1={startX}
        y1={y}
        x2={endX}
        y2={y}
        stroke="url(#trailGradient)"
        strokeWidth="2"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 1 }}
        animate={{ pathLength: 1, opacity: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      />
    </svg>
  );
}

// Progress dots component
function ProgressDots({ activeStage }: { activeStage: number }) {
  return (
    <div className="flex justify-center gap-1.5 mt-4">
      {stages.map((stage, index) => (
        <motion.div
          key={stage.key}
          className={`w-2 h-2 rounded-full transition-colors duration-300`}
          style={{
            backgroundColor: index <= activeStage ? stage.accent : "#e2e8f0",
          }}
          animate={index === activeStage ? { scale: [1, 1.3, 1] } : {}}
          transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
        />
      ))}
    </div>
  );
}

// Background decoration component
function BackgroundDecoration() {
  return (
    <div className="absolute inset-0 overflow-hidden -z-10 rounded-xl">
      {/* Gradient blobs */}
      <div className="absolute -top-20 left-1/4 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-20 right-1/4 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.02] dark:opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #64748b 1px, transparent 1px), linear-gradient(to bottom, #64748b 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
    </div>
  );
}

// Browser chrome component
function BrowserChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative rounded-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shadow-2xl shadow-slate-900/10 dark:shadow-slate-900/50 border border-slate-200 dark:border-slate-800">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 rounded-t-xl">
        {/* Traffic lights */}
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>

        {/* URL bar */}
        <div className="flex-1 flex justify-center">
          <div className="px-4 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-xs text-slate-500 dark:text-slate-400 font-mono">
            loopforge.studio/dashboard
          </div>
        </div>
      </div>

      {/* Content */}
      {children}
    </div>
  );
}

// Main component
interface ModernKanbanProps {
  className?: string;
}

export function ModernKanban({ className = "" }: ModernKanbanProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [activeStage, setActiveStage] = useState(0);
  const [previousStage, setPreviousStage] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Measure container
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  // Stage cycling
  useEffect(() => {
    if (isPaused) return;

    const duration = stageDurations[activeStage];

    const timeout = setTimeout(() => {
      const nextStage = (activeStage + 1) % 6;
      setPreviousStage(activeStage);
      setIsTransitioning(true);
      setActiveStage(nextStage);

      // Clear transition state
      setTimeout(() => setIsTransitioning(false), 400);
    }, duration);

    return () => clearTimeout(timeout);
  }, [activeStage, isPaused]);

  return (
    <div ref={containerRef} className={`relative mx-auto ${className}`}>
      {/* Bottom fade */}
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-background via-background/60 to-transparent z-10 pointer-events-none" />

      <BrowserChrome>
        <BackgroundDecoration />

        {/* Kanban board */}
        <div className="relative p-6 overflow-visible">
          {/* Transition trail */}
          <TransitionTrail
            fromIndex={previousStage}
            toIndex={activeStage}
            isAnimating={isTransitioning}
            containerWidth={containerWidth}
          />

          {/* Columns */}
          <div className="flex gap-3">
            {stages.map((stage, index) => (
              <KanbanColumn
                key={stage.key}
                stage={stage}
                stageIndex={index}
                isActive={index === activeStage}
                showCard={index === activeStage}
                onPause={setIsPaused}
              />
            ))}
          </div>

          {/* Progress dots */}
          <ProgressDots activeStage={activeStage} />
        </div>
      </BrowserChrome>

      {/* Glow effect */}
      <div className="absolute -inset-4 bg-primary/5 rounded-2xl blur-2xl -z-20" />
    </div>
  );
}
