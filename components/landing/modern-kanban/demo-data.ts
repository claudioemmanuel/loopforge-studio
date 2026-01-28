import {
  Clock,
  Lightbulb,
  FileText,
  Zap,
  Play,
  Eye,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export type TaskStatus =
  | "todo"
  | "brainstorming"
  | "planning"
  | "ready"
  | "executing"
  | "review"
  | "done"
  | "stuck";

export interface DemoCard {
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

export interface DemoPhase {
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

export const columns = [
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

export type Column = (typeof columns)[number];

// Initial card states
export const initialCards: DemoCard[] = [
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
export const demoPhases: DemoPhase[] = [
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
