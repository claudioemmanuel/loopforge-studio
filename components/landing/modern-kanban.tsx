"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Clock,
  Lightbulb,
  FileText,
  Zap,
  Play,
  Eye,
  CheckCircle2,
  AlertTriangle,
  GitBranch,
  Bot,
  Lock,
  Unlock,
} from "lucide-react";
import {
  calculateRoutedPath,
  groupConnectionsByTarget,
  type Rect,
  type Point,
} from "@/lib/utils/dependency-routing";

// ============================================================================
// Types
// ============================================================================

type TaskStatus =
  | "todo"
  | "brainstorming"
  | "planning"
  | "ready"
  | "executing"
  | "review"
  | "done"
  | "stuck";

interface DemoCard {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  isBlocked: boolean;
  blockedByIds: string[];
  branch?: string;
  progress: number;
  tags: { label: string; color: string }[];
  isProtagonist?: boolean;
}

interface DemoPhase {
  duration: number;
  cards: Partial<DemoCard>[];
  activeCardId: string | null;
  showDependencyLine?: {
    from: string;
    to: string;
    state: "active" | "unlocking" | "hidden";
  };
}

// ============================================================================
// Configuration
// ============================================================================

const columns = [
  {
    key: "todo" as TaskStatus,
    label: "Todo",
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
    key: "brainstorming" as TaskStatus,
    label: "Brainstorm",
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
    key: "planning" as TaskStatus,
    label: "Plan",
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
    key: "ready" as TaskStatus,
    label: "Ready",
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
    key: "executing" as TaskStatus,
    label: "Execute",
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
    key: "review" as TaskStatus,
    label: "Review",
    Icon: Eye,
    lightBg: "bg-cyan-50",
    lightBorder: "border-cyan-200",
    lightText: "text-cyan-600",
    darkBg: "dark:bg-cyan-900/20",
    darkBorder: "dark:border-cyan-800",
    darkText: "dark:text-cyan-400",
    accent: "#06b6d4",
    accentLight: "bg-cyan-500",
  },
  {
    key: "done" as TaskStatus,
    label: "Done",
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
  {
    key: "stuck" as TaskStatus,
    label: "Stuck",
    Icon: AlertTriangle,
    lightBg: "bg-red-50",
    lightBorder: "border-red-200",
    lightText: "text-red-600",
    darkBg: "dark:bg-red-900/20",
    darkBorder: "dark:border-red-800",
    darkText: "dark:text-red-400",
    accent: "#ef4444",
    accentLight: "bg-red-500",
  },
] as const;

// Initial card states
const initialCards: DemoCard[] = [
  {
    id: "card-1",
    title: "Add user authentication",
    description: "Implement OAuth2 login with GitHub provider",
    status: "todo",
    isBlocked: true,
    blockedByIds: ["card-2"],
    progress: 0,
    tags: [
      { label: "feature", color: "violet" },
      { label: "priority", color: "amber" },
    ],
    isProtagonist: true,
  },
  {
    id: "card-2",
    title: "Setup database schema",
    description: "Create users and sessions tables",
    status: "done",
    isBlocked: false,
    blockedByIds: [],
    progress: 100,
    tags: [{ label: "setup", color: "blue" }],
  },
  {
    id: "card-3",
    title: "Add password reset",
    description: "Email-based password recovery flow",
    status: "todo",
    isBlocked: true,
    blockedByIds: ["card-1"],
    progress: 0,
    tags: [{ label: "feature", color: "violet" }],
  },
  {
    id: "card-4",
    title: "Fix login validation",
    description: "Improve error messages on form",
    status: "review",
    isBlocked: false,
    blockedByIds: [],
    branch: "fix/login-errors",
    progress: 85,
    tags: [{ label: "bugfix", color: "emerald" }],
  },
  {
    id: "card-5",
    title: "API rate limiting",
    description: "Add rate limits to auth endpoints",
    status: "stuck",
    isBlocked: false,
    blockedByIds: [],
    progress: 45,
    tags: [{ label: "security", color: "red" }],
  },
];

// Demo phases configuration (20-second cycle)
const demoPhases: DemoPhase[] = [
  // Phase 0 (0-2s): Initial state - Card 1 blocked in Todo
  {
    duration: 2000,
    activeCardId: "card-1",
    cards: [{ id: "card-1", status: "todo", isBlocked: true, progress: 0 }],
    showDependencyLine: { from: "card-2", to: "card-1", state: "active" },
  },
  // Phase 1 (2-4s): Card 1 unblocks, moves to Brainstorm, Card 3 appears
  {
    duration: 2000,
    activeCardId: "card-1",
    cards: [
      { id: "card-1", status: "brainstorming", isBlocked: false, progress: 15 },
      { id: "card-3", status: "todo", isBlocked: true },
    ],
    showDependencyLine: { from: "card-1", to: "card-3", state: "active" },
  },
  // Phase 2 (4-6s): Card 1 in Planning
  {
    duration: 2000,
    activeCardId: "card-1",
    cards: [{ id: "card-1", status: "planning", progress: 30 }],
    showDependencyLine: { from: "card-1", to: "card-3", state: "active" },
  },
  // Phase 3 (6-8s): Card 1 in Ready
  {
    duration: 2000,
    activeCardId: "card-1",
    cards: [{ id: "card-1", status: "ready", progress: 45 }],
    showDependencyLine: { from: "card-1", to: "card-3", state: "active" },
  },
  // Phase 4 (8-12s): Card 1 Executing (longer phase)
  {
    duration: 4000,
    activeCardId: "card-1",
    cards: [
      { id: "card-1", status: "executing", branch: "feat/auth", progress: 45 },
    ],
    showDependencyLine: { from: "card-1", to: "card-3", state: "active" },
  },
  // Phase 5 (12-14s): Card 1 in Review
  {
    duration: 2000,
    activeCardId: "card-1",
    cards: [{ id: "card-1", status: "review", progress: 90 }],
    showDependencyLine: { from: "card-1", to: "card-3", state: "active" },
  },
  // Phase 6 (14-17s): Card 1 Done, Card 3 unlocks
  {
    duration: 3000,
    activeCardId: "card-3",
    cards: [
      { id: "card-1", status: "done", progress: 100 },
      { id: "card-3", status: "todo", isBlocked: false },
    ],
    showDependencyLine: { from: "card-1", to: "card-3", state: "unlocking" },
  },
  // Phase 7 (17-20s): Reset pause
  {
    duration: 3000,
    activeCardId: null,
    cards: [],
    showDependencyLine: { from: "card-1", to: "card-3", state: "hidden" },
  },
];

// ============================================================================
// Helper Components
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
// Task Card Component
// ============================================================================

interface TaskCardProps {
  card: DemoCard;
  column: (typeof columns)[number];
  isActive: boolean;
  onPause: (paused: boolean) => void;
  executingProgress?: number;
}

function TaskCard({
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

// ============================================================================
// Kanban Column Component
// ============================================================================

interface KanbanColumnProps {
  column: (typeof columns)[number];
  cards: DemoCard[];
  activeCardId: string | null;
  onPause: (paused: boolean) => void;
  executingProgress?: number;
}

function KanbanColumn({
  column,
  cards,
  activeCardId,
  onPause,
  executingProgress,
}: KanbanColumnProps) {
  const shouldReduceMotion = useReducedMotion();
  const Icon = column.Icon;
  const columnCards = cards.filter((c) => c.status === column.key);
  const hasActiveCard = columnCards.some((c) => c.id === activeCardId);

  return (
    <motion.div
      data-column={column.key}
      className={`
        w-[140px] shrink-0 rounded-lg border p-2
        ${column.lightBg} ${column.lightBorder}
        ${column.darkBg} ${column.darkBorder}
        transition-all duration-300
        ${hasActiveCard ? "ring-2 ring-offset-1 ring-offset-white dark:ring-offset-slate-900" : ""}
      `}
      style={
        hasActiveCard
          ? ({ "--tw-ring-color": column.accent } as React.CSSProperties)
          : {}
      }
      animate={
        hasActiveCard && !shouldReduceMotion
          ? {
              boxShadow: [
                `0 0 0 0 ${column.accent}20`,
                `0 0 0 4px ${column.accent}10`,
                `0 0 0 0 ${column.accent}20`,
              ],
            }
          : {}
      }
      transition={
        hasActiveCard && !shouldReduceMotion
          ? { boxShadow: { duration: 2, repeat: Infinity } }
          : {}
      }
    >
      {/* Column header */}
      <div className="flex items-center gap-1 mb-2 px-0.5">
        <motion.div
          animate={
            hasActiveCard && !shouldReduceMotion
              ? { rotate: [0, 10, -10, 0] }
              : {}
          }
          transition={
            hasActiveCard
              ? { duration: 0.5, repeat: Infinity, repeatDelay: 2 }
              : {}
          }
        >
          <Icon className={`w-3 h-3 ${column.lightText} ${column.darkText}`} />
        </motion.div>
        <span
          className={`text-[9px] font-semibold ${column.lightText} ${column.darkText}`}
        >
          {column.label}
        </span>
        <span
          className={`ml-auto text-[8px] font-medium px-1 py-0.5 rounded-full bg-white/60 dark:bg-slate-800/60 ${column.lightText} ${column.darkText}`}
        >
          {columnCards.length}
        </span>
      </div>

      {/* Column body */}
      <div className="h-[300px] space-y-2 overflow-hidden">
        <AnimatePresence mode="popLayout">
          {columnCards.map((card) => (
            <TaskCard
              key={card.id}
              card={card}
              column={column}
              isActive={card.id === activeCardId}
              onPause={onPause}
              executingProgress={
                card.status === "executing" ? executingProgress : undefined
              }
            />
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Dependency Lines Component
// ============================================================================

interface DependencyLinesProps {
  cards: DemoCard[];
  containerRef: React.RefObject<HTMLDivElement>;
  highlightedConnection?: {
    from: string;
    to: string;
    state: "active" | "unlocking" | "hidden";
  };
}

function DependencyLines({
  cards,
  containerRef,
  highlightedConnection,
}: DependencyLinesProps) {
  const shouldReduceMotion = useReducedMotion();
  const [connections, setConnections] = useState<
    Array<{
      fromId: string;
      toId: string;
      path: string;
      state: "active" | "unlocking" | "hidden";
      isBackward: boolean;
    }>
  >([]);

  const updateConnections = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();

    // Collect all card rectangles for obstacle detection
    const cardElements = container.querySelectorAll("[data-card-id]");
    const allCardRects: { id: string; rect: Rect }[] = [];
    cardElements.forEach((el) => {
      const domRect = el.getBoundingClientRect();
      const id = el.getAttribute("data-card-id");
      if (id) {
        allCardRects.push({
          id,
          rect: {
            left: domRect.left - containerRect.left,
            right: domRect.right - containerRect.left,
            top: domRect.top - containerRect.top,
            bottom: domRect.bottom - containerRect.top,
          },
        });
      }
    });

    // First pass: collect raw connection data
    const rawConnections: {
      fromId: string;
      toId: string;
      fromPos: Point;
      toPos: Point;
      fromRect: Rect;
      toRect: Rect;
      state: "active" | "unlocking" | "hidden";
    }[] = [];

    cards.forEach((card) => {
      if (card.blockedByIds.length === 0) return;

      const toCardData = allCardRects.find((c) => c.id === card.id);
      if (!toCardData) return;

      card.blockedByIds.forEach((blockerId) => {
        const fromCardData = allCardRects.find((c) => c.id === blockerId);
        if (!fromCardData) return;

        const fromRect = fromCardData.rect;
        const toRect = toCardData.rect;

        const fromPos = {
          x: fromRect.right,
          y: fromRect.top + (fromRect.bottom - fromRect.top) / 2,
        };
        const toPos = {
          x: toRect.left,
          y: toRect.top + (toRect.bottom - toRect.top) / 2,
        };

        let state: "active" | "unlocking" | "hidden" = "active";
        if (
          highlightedConnection &&
          highlightedConnection.from === blockerId &&
          highlightedConnection.to === card.id
        ) {
          state = highlightedConnection.state;
        }

        rawConnections.push({
          fromId: blockerId,
          toId: card.id,
          fromPos,
          toPos,
          fromRect,
          toRect,
          state,
        });
      });
    });

    // Group connections by target to calculate offsets for parallel lines
    const connectionsByTarget = groupConnectionsByTarget(rawConnections);

    // Second pass: calculate routed paths with offsets
    const allRects = allCardRects.map((c) => c.rect);
    const newConnections: typeof connections = [];

    rawConnections.forEach((conn) => {
      const targetGroup = connectionsByTarget.get(conn.toId) || [];
      const lineIndex = targetGroup.indexOf(conn);
      const totalLines = targetGroup.length;

      const { path, isBackward } = calculateRoutedPath(
        {
          from: conn.fromPos,
          to: conn.toPos,
          fromRect: conn.fromRect,
          toRect: conn.toRect,
        },
        allRects,
        lineIndex,
        totalLines,
      );

      newConnections.push({
        fromId: conn.fromId,
        toId: conn.toId,
        path,
        state: conn.state,
        isBackward,
      });
    });

    setConnections(newConnections);
  }, [cards, containerRef, highlightedConnection]);

  useEffect(() => {
    updateConnections();
    window.addEventListener("resize", updateConnections);
    return () => window.removeEventListener("resize", updateConnections);
  }, [updateConnections]);

  // Re-render when cards update (for position changes)
  useEffect(() => {
    const timer = setTimeout(updateConnections, 100);
    return () => clearTimeout(timer);
  }, [cards, updateConnections]);

  if (shouldReduceMotion || connections.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-20"
      style={{ overflow: "visible" }}
    >
      <defs>
        {/* Forward active gradient (amber to red) */}
        <linearGradient
          id="dep-gradient-active"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="0%"
        >
          <stop offset="0%" stopColor="rgb(251, 191, 36)" stopOpacity="0.7" />
          <stop offset="100%" stopColor="rgb(239, 68, 68)" stopOpacity="0.7" />
        </linearGradient>
        {/* Unlocking gradient (green) */}
        <linearGradient
          id="dep-gradient-unlock"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="0%"
        >
          <stop offset="0%" stopColor="rgb(34, 197, 94)" stopOpacity="0.8" />
          <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity="0.8" />
        </linearGradient>
        {/* Backward gradient (subtle slate) */}
        <linearGradient
          id="dep-gradient-backward"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="0%"
        >
          <stop offset="0%" stopColor="rgb(100, 116, 139)" stopOpacity="0.25" />
          <stop
            offset="100%"
            stopColor="rgb(100, 116, 139)"
            stopOpacity="0.25"
          />
        </linearGradient>
        {/* Arrow markers */}
        <marker
          id="arrowhead-active"
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
          orient="auto"
        >
          <polygon
            points="0 0, 8 3, 0 6"
            fill="rgb(239, 68, 68)"
            fillOpacity="0.7"
          />
        </marker>
        <marker
          id="arrowhead-unlock"
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
          orient="auto"
        >
          <polygon
            points="0 0, 8 3, 0 6"
            fill="rgb(16, 185, 129)"
            fillOpacity="0.8"
          />
        </marker>
        <marker
          id="arrowhead-backward"
          markerWidth="6"
          markerHeight="5"
          refX="5"
          refY="2.5"
          orient="auto"
        >
          <polygon
            points="0 0, 6 2.5, 0 5"
            fill="rgb(100, 116, 139)"
            fillOpacity="0.3"
          />
        </marker>
      </defs>

      {connections.map((conn) => {
        if (conn.state === "hidden") return null;

        const isUnlocking = conn.state === "unlocking";

        // Determine styling based on direction and state
        const getStroke = () => {
          if (isUnlocking) return "url(#dep-gradient-unlock)";
          if (conn.isBackward) return "url(#dep-gradient-backward)";
          return "url(#dep-gradient-active)";
        };

        const getStrokeWidth = () => {
          if (isUnlocking) return 2;
          if (conn.isBackward) return 1;
          return 1.5;
        };

        const getDashArray = () => {
          if (isUnlocking) return "none";
          if (conn.isBackward) return "2 3";
          return "4 4";
        };

        const getMarkerEnd = () => {
          if (isUnlocking) return "url(#arrowhead-unlock)";
          if (conn.isBackward) return "url(#arrowhead-backward)";
          return "url(#arrowhead-active)";
        };

        return (
          <motion.path
            key={`${conn.fromId}-${conn.toId}`}
            d={conn.path}
            fill="none"
            stroke={getStroke()}
            strokeWidth={getStrokeWidth()}
            strokeDasharray={getDashArray()}
            markerEnd={getMarkerEnd()}
            initial={{ opacity: 0, pathLength: 0 }}
            animate={{
              opacity: isUnlocking ? [1, 0] : conn.isBackward ? 0.4 : 0.6,
              pathLength: 1,
            }}
            transition={{
              opacity: isUnlocking
                ? { duration: 1.5, ease: "easeOut" }
                : { duration: 0.3 },
              pathLength: { duration: 0.5, ease: "easeOut" },
            }}
          />
        );
      })}
    </svg>
  );
}

// ============================================================================
// Progress Dots Component
// ============================================================================

function ProgressDots({
  currentPhase,
  totalPhases,
}: {
  currentPhase: number;
  totalPhases: number;
}) {
  return (
    <div className="flex justify-center gap-1.5 mt-3">
      {Array.from({ length: totalPhases }).map((_, index) => (
        <motion.div
          key={index}
          className="w-1.5 h-1.5 rounded-full transition-colors duration-300"
          style={{
            backgroundColor: index <= currentPhase ? "#10b981" : "#e2e8f0",
          }}
          animate={index === currentPhase ? { scale: [1, 1.3, 1] } : {}}
          transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Browser Chrome Component
// ============================================================================

function BrowserChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative rounded-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shadow-2xl shadow-slate-900/10 dark:shadow-slate-900/50 border border-slate-200 dark:border-slate-800">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 rounded-t-xl">
        {/* Traffic lights */}
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
        </div>

        {/* URL bar */}
        <div className="flex-1 flex justify-center">
          <div className="px-3 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
            loopforge.studio/dashboard
          </div>
        </div>
      </div>

      {/* Content */}
      {children}
    </div>
  );
}

// ============================================================================
// Background Decoration Component
// ============================================================================

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

// ============================================================================
// Main Component
// ============================================================================

interface ModernKanbanProps {
  className?: string;
}

export function ModernKanban({ className = "" }: ModernKanbanProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [cards, setCards] = useState<DemoCard[]>(initialCards);
  const [isPaused, setIsPaused] = useState(false);
  const [executingProgress, setExecutingProgress] = useState(45);

  // Apply phase changes to cards
  const applyPhaseChanges = useCallback((phaseIndex: number) => {
    const phase = demoPhases[phaseIndex];
    if (!phase) return;

    setCards((prevCards) => {
      const newCards = [...prevCards];

      // Reset to initial state on last phase
      if (phaseIndex === demoPhases.length - 1) {
        return initialCards;
      }

      // Apply phase-specific card changes
      phase.cards.forEach((cardUpdate) => {
        const cardIndex = newCards.findIndex((c) => c.id === cardUpdate.id);
        if (cardIndex !== -1) {
          newCards[cardIndex] = { ...newCards[cardIndex], ...cardUpdate };
        }
      });

      return newCards;
    });

    // Reset executing progress at start of execute phase
    if (phaseIndex === 4) {
      setExecutingProgress(45);
    }
  }, []);

  // Animate executing progress during execute phase
  useEffect(() => {
    if (currentPhase === 4 && !isPaused) {
      const interval = setInterval(() => {
        setExecutingProgress((p) => Math.min(p + 3, 85));
      }, 200);
      return () => clearInterval(interval);
    }
  }, [currentPhase, isPaused]);

  // Phase cycling
  useEffect(() => {
    if (isPaused) return;

    const phase = demoPhases[currentPhase];
    if (!phase) return;

    const timeout = setTimeout(() => {
      const nextPhase = (currentPhase + 1) % demoPhases.length;
      setCurrentPhase(nextPhase);
      applyPhaseChanges(nextPhase);
    }, phase.duration);

    return () => clearTimeout(timeout);
  }, [currentPhase, isPaused, applyPhaseChanges]);

  // Initialize with first phase
  useEffect(() => {
    applyPhaseChanges(0);
  }, [applyPhaseChanges]);

  const activeCardId = demoPhases[currentPhase]?.activeCardId || null;
  const dependencyLine = demoPhases[currentPhase]?.showDependencyLine;

  return (
    <div ref={containerRef} className={`relative mx-auto ${className}`}>
      {/* Bottom fade */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background via-background/60 to-transparent z-10 pointer-events-none" />

      <BrowserChrome>
        <BackgroundDecoration />

        {/* Kanban board */}
        <div ref={boardRef} className="relative p-4 overflow-x-auto">
          {/* Dependency lines */}
          <DependencyLines
            cards={cards}
            containerRef={boardRef as React.RefObject<HTMLDivElement>}
            highlightedConnection={dependencyLine}
          />

          {/* Columns */}
          <div className="flex gap-2 min-w-max">
            {columns.map((column) => (
              <KanbanColumn
                key={column.key}
                column={column}
                cards={cards}
                activeCardId={activeCardId}
                onPause={setIsPaused}
                executingProgress={executingProgress}
              />
            ))}
          </div>

          {/* Progress dots */}
          <ProgressDots
            currentPhase={currentPhase}
            totalPhases={demoPhases.length}
          />
        </div>
      </BrowserChrome>

      {/* Glow effect */}
      <div className="absolute -inset-4 bg-primary/5 rounded-2xl blur-2xl -z-20" />

      {/* CSS for rotating gradient border */}
      <style jsx global>{`
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
        .bg-gradient-conic {
          background: conic-gradient(from 0deg, var(--tw-gradient-stops));
        }
      `}</style>
    </div>
  );
}
