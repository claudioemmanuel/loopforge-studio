# Dashboard, Analytics & Settings Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the basic dashboard into a professional, emotionally engaging UI with inline-expandable repo cards, comprehensive analytics, full settings suite, and smooth View Transitions.

**Architecture:** Component-based React with server components for data fetching, client components for interactivity. Analytics uses aggregation queries on existing tables. Settings organized in tabs with separate components. View Transitions API for smooth page morphing.

**Tech Stack:** Next.js 15.2+, React 19, TypeScript, Tailwind CSS, shadcn/ui, Recharts, Lucide icons, View Transitions API

---

## Phase 1: Foundation & Dependencies

### Task 1: Add Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install recharts and date-fns**

Run:
```bash
npm install recharts date-fns
```

**Step 2: Verify installation**

Run: `npm ls recharts date-fns`
Expected: Shows both packages installed

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add recharts and date-fns dependencies"
```

---

### Task 2: Enable View Transitions API

**Files:**
- Modify: `next.config.ts`

**Step 1: Read current config**

Read `next.config.ts` to understand current structure.

**Step 2: Add viewTransition experimental flag**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
  },
};

export default nextConfig;
```

**Step 3: Verify config is valid**

Run: `npm run build`
Expected: Build succeeds without errors

**Step 4: Commit**

```bash
git add next.config.ts
git commit -m "feat: enable View Transitions API experimental flag"
```

---

## Phase 2: Sidebar Redesign

### Task 3: Update Sidebar with LoopforgeIcon and Lucide Icons

**Files:**
- Modify: `components/sidebar.tsx`

**Step 1: Read current sidebar implementation**

Read `components/sidebar.tsx` to understand current structure.

**Step 2: Update imports and nav items**

Replace emoji icons with Lucide icons, import LoopforgeIcon:

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LoopforgeIcon } from "@/components/loopforge-logo";
import { Home, BarChart3, Settings } from "lucide-react";

interface SidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];
```

**Step 3: Update logo section**

Replace lightning bolt SVG with LoopforgeIcon and add font-serif styling:

```typescript
<div className="p-4 border-b">
  <Link href="/" className="flex items-center gap-2">
    <LoopforgeIcon size={32} />
    <span className="font-serif font-bold text-lg tracking-tight">
      <span className="text-primary">Loop</span>forge
    </span>
  </Link>
</div>
```

**Step 4: Update nav items rendering**

```typescript
<nav className="flex-1 p-4 space-y-1">
  {navItems.map((item) => {
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
          pathname === item.href
            ? "bg-primary/10 text-primary font-medium"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <Icon className="w-4 h-4" />
        {item.label}
      </Link>
    );
  })}
</nav>
```

**Step 5: Run dev server and verify visually**

Run: `npm run dev`
Expected: Sidebar shows infinity loop icon and styled "Loopforge" text

**Step 6: Commit**

```bash
git add components/sidebar.tsx
git commit -m "feat: update sidebar with LoopforgeIcon and Lucide icons"
```

---

## Phase 3: Dashboard Redesign

### Task 4: Create Stats Card Component

**Files:**
- Create: `components/dashboard/stat-card.tsx`

**Step 1: Create the component**

```typescript
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  trend?: {
    value: number;
    label: string;
    positive?: boolean;
  };
  icon?: LucideIcon;
  className?: string;
}

export function StatCard({ title, value, trend, icon: Icon, className }: StatCardProps) {
  return (
    <div className={cn(
      "p-6 rounded-xl border bg-card shadow-sm",
      className
    )}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
      </div>
      <p className="text-3xl font-bold mt-2">{value}</p>
      {trend && (
        <p className={cn(
          "text-xs mt-1",
          trend.positive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
        )}>
          {trend.positive ? "↑" : "↓"} {Math.abs(trend.value)} {trend.label}
        </p>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/dashboard/stat-card.tsx
git commit -m "feat: add StatCard component for dashboard metrics"
```

---

### Task 5: Create Activity Feed Component

**Files:**
- Create: `components/dashboard/activity-feed.tsx`

**Step 1: Create the component**

```typescript
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, AlertCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ActivityItem {
  id: string;
  taskTitle: string;
  repoName: string;
  status: "completed" | "executing" | "stuck" | "pending";
  timestamp: Date;
}

interface ActivityFeedProps {
  items: ActivityItem[];
  className?: string;
}

const statusConfig = {
  completed: { icon: CheckCircle2, color: "text-green-600 dark:text-green-400", label: "completed" },
  executing: { icon: Loader2, color: "text-blue-600 dark:text-blue-400", label: "executing", animate: true },
  stuck: { icon: AlertCircle, color: "text-amber-600 dark:text-amber-400", label: "stuck" },
  pending: { icon: Clock, color: "text-muted-foreground", label: "pending" },
};

export function ActivityFeed({ items, className }: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <div className={cn("p-6 rounded-xl border bg-card", className)}>
        <h3 className="text-sm font-medium text-muted-foreground mb-4">Recent Activity</h3>
        <p className="text-sm text-muted-foreground text-center py-8">
          No recent activity. Create a task to get started.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("p-6 rounded-xl border bg-card", className)}>
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Recent Activity</h3>
      <div className="space-y-3">
        {items.map((item) => {
          const config = statusConfig[item.status];
          const Icon = config.icon;
          return (
            <div key={item.id} className="flex items-center gap-3 text-sm">
              <Icon className={cn(
                "w-4 h-4 flex-shrink-0",
                config.color,
                config.animate && "animate-spin"
              )} />
              <span className="flex-1 truncate">
                &quot;{item.taskTitle}&quot; {config.label}
              </span>
              <span className="text-muted-foreground text-xs">{item.repoName}</span>
              <span className="text-muted-foreground text-xs">
                {formatDistanceToNow(item.timestamp, { addSuffix: true })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/dashboard/activity-feed.tsx
git commit -m "feat: add ActivityFeed component for dashboard"
```

---

### Task 6: Create Welcome Banner Component

**Files:**
- Create: `components/dashboard/welcome-banner.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WelcomeBannerProps {
  repoCount: number;
  onDismiss?: () => void;
}

export function WelcomeBanner({ repoCount, onDismiss }: WelcomeBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div className="relative p-6 rounded-xl border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent mb-6">
      <button
        onClick={handleDismiss}
        className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
      >
        <X className="w-4 h-4" />
      </button>
      <h2 className="text-xl font-semibold mb-2">Welcome to Loopforge!</h2>
      <p className="text-muted-foreground mb-4">
        You&apos;ve connected {repoCount} {repoCount === 1 ? "repository" : "repositories"}. Here&apos;s how to get started:
      </p>
      <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground mb-4">
        <li>Click a repository below to open its Kanban board</li>
        <li>Create your first task with the &quot;New Task&quot; button</li>
        <li>Watch AI brainstorm, plan, and execute your task</li>
      </ol>
      <Button onClick={handleDismiss}>Got it, let&apos;s go!</Button>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/dashboard/welcome-banner.tsx
git commit -m "feat: add WelcomeBanner component for first-time users"
```

---

### Task 7: Create Expandable Repo Card Component

**Files:**
- Create: `components/dashboard/repo-card-expandable.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, ExternalLink, Lock, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Task, TaskStatus } from "@/lib/db/schema";

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

const statusColumns: { status: TaskStatus; label: string }[] = [
  { status: "todo", label: "Todo" },
  { status: "brainstorming", label: "Brainstorm" },
  { status: "planning", label: "Planning" },
  { status: "ready", label: "Ready" },
  { status: "executing", label: "Executing" },
  { status: "done", label: "Done" },
];

export function RepoCardExpandable({ repo, tasks, isNew }: RepoCardExpandableProps) {
  const [expanded, setExpanded] = useState(false);

  const activeTasks = tasks.filter(t =>
    t.status === "executing" || t.status === "brainstorming" || t.status === "planning"
  ).length;

  const tasksByStatus = statusColumns.map(col => ({
    ...col,
    tasks: tasks.filter(t => t.status === col.status),
  }));

  return (
    <div className={cn(
      "rounded-xl border bg-card transition-all duration-300",
      expanded && "shadow-lg"
    )}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 text-left flex items-center gap-3"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold truncate">{repo.name}</span>
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
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Mini Kanban</span>
            <Link href={`/repos/${repo.id}`}>
              <Button variant="outline" size="sm">
                Open Full Board
                <ExternalLink className="w-3 h-3 ml-2" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-6 gap-2 overflow-x-auto">
            {tasksByStatus.map(col => (
              <div key={col.status} className="min-w-0">
                <div className="text-xs font-medium text-muted-foreground mb-2 truncate">
                  {col.label} ({col.tasks.length})
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {col.tasks.slice(0, 3).map(task => (
                    <div
                      key={task.id}
                      className="p-2 text-xs bg-muted rounded truncate"
                      title={task.title}
                    >
                      {task.title}
                    </div>
                  ))}
                  {col.tasks.length > 3 && (
                    <div className="text-xs text-muted-foreground text-center">
                      +{col.tasks.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/dashboard/repo-card-expandable.tsx
git commit -m "feat: add RepoCardExpandable with mini-Kanban preview"
```

---

### Task 8: Create Dashboard Index Export

**Files:**
- Create: `components/dashboard/index.ts`

**Step 1: Create barrel export**

```typescript
export { StatCard } from "./stat-card";
export { ActivityFeed } from "./activity-feed";
export { WelcomeBanner } from "./welcome-banner";
export { RepoCardExpandable } from "./repo-card-expandable";
```

**Step 2: Commit**

```bash
git add components/dashboard/index.ts
git commit -m "feat: add dashboard components barrel export"
```

---

### Task 9: Update Dashboard Page

**Files:**
- Modify: `app/(dashboard)/page.tsx`

**Step 1: Rewrite dashboard page with new components**

```typescript
import { auth } from "@/lib/auth";
import { db, repos, tasks } from "@/lib/db";
import { eq, desc, and, gte } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatCard, ActivityFeed, WelcomeBanner, RepoCardExpandable } from "@/components/dashboard";
import { ListTodo, CheckCircle2, Zap, TrendingUp } from "lucide-react";
import { subDays } from "date-fns";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;

  if (!session?.user?.id) {
    return null;
  }

  const userId = session.user.id;
  const showWelcome = params.welcome === "true";
  const weekAgo = subDays(new Date(), 7);

  // Fetch user repos with tasks
  const userRepos = await db.query.repos.findMany({
    where: eq(repos.userId, userId),
    orderBy: [desc(repos.updatedAt)],
  });

  // Fetch all tasks for user's repos
  const repoIds = userRepos.map(r => r.id);
  const allTasks = repoIds.length > 0
    ? await db.query.tasks.findMany({
        where: (tasks, { inArray }) => inArray(tasks.repoId, repoIds),
        orderBy: [desc(tasks.updatedAt)],
      })
    : [];

  // Calculate stats
  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter(t => t.status === "done").length;
  const inProgressTasks = allTasks.filter(t =>
    ["executing", "brainstorming", "planning"].includes(t.status)
  ).length;
  const successRate = totalTasks > 0
    ? Math.round((completedTasks / totalTasks) * 100)
    : 0;

  // Recent activity (last 5 tasks updated)
  const recentActivity = allTasks.slice(0, 5).map(task => {
    const repo = userRepos.find(r => r.id === task.repoId);
    return {
      id: task.id,
      taskTitle: task.title,
      repoName: repo?.name || "Unknown",
      status: task.status === "done" ? "completed" as const
        : task.status === "executing" ? "executing" as const
        : task.status === "stuck" ? "stuck" as const
        : "pending" as const,
      timestamp: task.updatedAt,
    };
  });

  // Tasks by repo for expandable cards
  const tasksByRepo = userRepos.map(repo => ({
    repo,
    tasks: allTasks.filter(t => t.repoId === repo.id),
  }));

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {session.user.name?.split(" ")[0] || "there"}
          </p>
        </div>
        <Link href="/onboarding">
          <Button>Add Repository</Button>
        </Link>
      </div>

      {showWelcome && userRepos.length > 0 && (
        <WelcomeBanner repoCount={userRepos.length} />
      )}

      {userRepos.length === 0 ? (
        <div className="max-w-md mx-auto text-center py-12">
          <h2 className="text-xl font-semibold mb-2">No repositories yet</h2>
          <p className="text-muted-foreground mb-4">
            Add your first repository to start using Loopforge
          </p>
          <Link href="/onboarding">
            <Button>Get Started</Button>
          </Link>
        </div>
      ) : (
        <>
          {/* Stats Overview */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <StatCard
              title="Total Tasks"
              value={totalTasks}
              icon={ListTodo}
            />
            <StatCard
              title="Completed"
              value={completedTasks}
              icon={CheckCircle2}
            />
            <StatCard
              title="In Progress"
              value={inProgressTasks}
              icon={Zap}
            />
            <StatCard
              title="Success Rate"
              value={`${successRate}%`}
              icon={TrendingUp}
            />
          </div>

          {/* Activity Feed */}
          <ActivityFeed items={recentActivity} className="mb-8" />

          {/* Repositories */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Your Repositories</h2>
            <div className="space-y-3">
              {tasksByRepo.map(({ repo, tasks }) => (
                <RepoCardExpandable
                  key={repo.id}
                  repo={repo}
                  tasks={tasks}
                  isNew={showWelcome}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

**Step 2: Verify the page renders**

Run: `npm run dev`
Navigate to: `http://localhost:3000`
Expected: Dashboard shows stats, activity feed, and expandable repo cards

**Step 3: Commit**

```bash
git add app/\(dashboard\)/page.tsx
git commit -m "feat: redesign dashboard with stats, activity feed, expandable repos"
```

---

## Phase 4: Onboarding Bug Fix

### Task 10: Fix Onboarding Multi-Repo Redirect

**Files:**
- Modify: `app/(auth)/onboarding/page.tsx`

**Step 1: Update handleCompleteManaged redirect**

Find and update the redirect after onboarding completion:

```typescript
// BEFORE (around line 166)
const { repoId } = await res.json();
router.push(`/repos/${repoId}`);

// AFTER
const { repoIds } = await res.json();
router.push("/?welcome=true");
```

**Step 2: Update handleCompleteBYOK redirect**

Find and update the redirect (around line 202):

```typescript
// BEFORE
const { repoId } = await res.json();
router.push(`/repos/${repoId}`);

// AFTER
const { repoIds } = await res.json();
router.push("/?welcome=true");
```

**Step 3: Update API to return repoIds array**

Read and modify `app/api/onboarding/complete/route.ts`:

```typescript
// Find the return statement and change:
// return NextResponse.json({ repoId: savedRepos[0].id });
// TO:
return NextResponse.json({
  repoIds: savedRepos.map(r => r.id),
  count: savedRepos.length
});
```

**Step 4: Verify fix**

Run: `npm run dev`
Test: Complete onboarding with multiple repos
Expected: Redirects to dashboard with welcome banner showing all repos

**Step 5: Commit**

```bash
git add app/\(auth\)/onboarding/page.tsx app/api/onboarding/complete/route.ts
git commit -m "fix: redirect to dashboard after multi-repo onboarding"
```

---

## Phase 5: Analytics Page

### Task 11: Create Analytics API Helper

**Files:**
- Create: `lib/api/analytics.ts`

**Step 1: Create analytics query functions**

```typescript
import { db, tasks, executions, usageRecords, repos } from "@/lib/db";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { startOfDay, endOfDay, subDays, eachDayOfInterval, format } from "date-fns";

export interface AnalyticsDateRange {
  start: Date;
  end: Date;
}

export interface TaskMetrics {
  total: number;
  completed: number;
  executing: number;
  stuck: number;
  successRate: number;
  avgCompletionTimeMinutes: number | null;
}

export interface TasksByStatus {
  status: string;
  count: number;
}

export interface DailyCompletion {
  date: string;
  completed: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  avgPerTask: number;
}

export interface CostBreakdown {
  totalCents: number;
  inputCostCents: number;
  outputCostCents: number;
  avgPerTaskCents: number;
}

export interface RepoActivity {
  repoId: string;
  repoName: string;
  commits: number;
  tasksCompleted: number;
}

export async function getTaskMetrics(
  userId: string,
  dateRange: AnalyticsDateRange
): Promise<TaskMetrics> {
  const userRepos = await db.query.repos.findMany({
    where: eq(repos.userId, userId),
  });
  const repoIds = userRepos.map(r => r.id);

  if (repoIds.length === 0) {
    return {
      total: 0,
      completed: 0,
      executing: 0,
      stuck: 0,
      successRate: 0,
      avgCompletionTimeMinutes: null,
    };
  }

  const allTasks = await db.query.tasks.findMany({
    where: (tasks, { inArray, and, gte, lte }) => and(
      inArray(tasks.repoId, repoIds),
      gte(tasks.createdAt, dateRange.start),
      lte(tasks.createdAt, dateRange.end)
    ),
  });

  const total = allTasks.length;
  const completed = allTasks.filter(t => t.status === "done").length;
  const executing = allTasks.filter(t => t.status === "executing").length;
  const stuck = allTasks.filter(t => t.status === "stuck").length;
  const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    total,
    completed,
    executing,
    stuck,
    successRate,
    avgCompletionTimeMinutes: null, // TODO: calculate from executions
  };
}

export async function getTasksByStatus(
  userId: string,
  dateRange: AnalyticsDateRange
): Promise<TasksByStatus[]> {
  const userRepos = await db.query.repos.findMany({
    where: eq(repos.userId, userId),
  });
  const repoIds = userRepos.map(r => r.id);

  if (repoIds.length === 0) return [];

  const allTasks = await db.query.tasks.findMany({
    where: (tasks, { inArray, and, gte, lte }) => and(
      inArray(tasks.repoId, repoIds),
      gte(tasks.createdAt, dateRange.start),
      lte(tasks.createdAt, dateRange.end)
    ),
  });

  const statusCounts: Record<string, number> = {};
  allTasks.forEach(task => {
    statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
  });

  return Object.entries(statusCounts).map(([status, count]) => ({
    status,
    count,
  }));
}

export async function getDailyCompletions(
  userId: string,
  dateRange: AnalyticsDateRange
): Promise<DailyCompletion[]> {
  const userRepos = await db.query.repos.findMany({
    where: eq(repos.userId, userId),
  });
  const repoIds = userRepos.map(r => r.id);

  if (repoIds.length === 0) return [];

  const completedTasks = await db.query.tasks.findMany({
    where: (tasks, { inArray, and, gte, lte, eq }) => and(
      inArray(tasks.repoId, repoIds),
      eq(tasks.status, "done"),
      gte(tasks.updatedAt, dateRange.start),
      lte(tasks.updatedAt, dateRange.end)
    ),
  });

  const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });

  return days.map(day => {
    const dayStr = format(day, "yyyy-MM-dd");
    const count = completedTasks.filter(t =>
      format(t.updatedAt, "yyyy-MM-dd") === dayStr
    ).length;
    return { date: dayStr, completed: count };
  });
}

export async function getTokenUsage(
  userId: string,
  dateRange: AnalyticsDateRange
): Promise<TokenUsage> {
  const records = await db.query.usageRecords.findMany({
    where: and(
      eq(usageRecords.userId, userId),
      gte(usageRecords.createdAt, dateRange.start),
      lte(usageRecords.createdAt, dateRange.end)
    ),
  });

  const inputTokens = records.reduce((sum, r) => sum + r.inputTokens, 0);
  const outputTokens = records.reduce((sum, r) => sum + r.outputTokens, 0);
  const totalTokens = inputTokens + outputTokens;
  const avgPerTask = records.length > 0 ? Math.round(totalTokens / records.length) : 0;

  return { inputTokens, outputTokens, totalTokens, avgPerTask };
}

export async function getCostBreakdown(
  userId: string,
  dateRange: AnalyticsDateRange
): Promise<CostBreakdown> {
  const records = await db.query.usageRecords.findMany({
    where: and(
      eq(usageRecords.userId, userId),
      gte(usageRecords.createdAt, dateRange.start),
      lte(usageRecords.createdAt, dateRange.end)
    ),
  });

  const totalCents = records.reduce((sum, r) => sum + r.costCents, 0);
  // Approximate split (Claude pricing: input ~$3/M, output ~$15/M)
  const inputCostCents = Math.round(totalCents * 0.4);
  const outputCostCents = totalCents - inputCostCents;
  const avgPerTaskCents = records.length > 0 ? Math.round(totalCents / records.length) : 0;

  return { totalCents, inputCostCents, outputCostCents, avgPerTaskCents };
}

export async function getRepoActivity(
  userId: string,
  dateRange: AnalyticsDateRange
): Promise<RepoActivity[]> {
  const userRepos = await db.query.repos.findMany({
    where: eq(repos.userId, userId),
  });

  const results: RepoActivity[] = [];

  for (const repo of userRepos) {
    const repoTasks = await db.query.tasks.findMany({
      where: and(
        eq(tasks.repoId, repo.id),
        gte(tasks.createdAt, dateRange.start),
        lte(tasks.createdAt, dateRange.end)
      ),
    });

    const completedTasks = repoTasks.filter(t => t.status === "done").length;

    // Count commits from executions
    const taskIds = repoTasks.map(t => t.id);
    let commits = 0;
    if (taskIds.length > 0) {
      const execs = await db.query.executions.findMany({
        where: (executions, { inArray }) => inArray(executions.taskId, taskIds),
      });
      commits = execs.reduce((sum, e) => sum + (e.commits?.length || 0), 0);
    }

    results.push({
      repoId: repo.id,
      repoName: repo.fullName,
      commits,
      tasksCompleted: completedTasks,
    });
  }

  return results;
}
```

**Step 2: Commit**

```bash
git add lib/api/analytics.ts
git commit -m "feat: add analytics query helper functions"
```

---

### Task 12: Create Analytics API Route

**Files:**
- Create: `app/api/analytics/route.ts`

**Step 1: Create the API route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { subDays, startOfDay, endOfDay } from "date-fns";
import {
  getTaskMetrics,
  getTasksByStatus,
  getDailyCompletions,
  getTokenUsage,
  getCostBreakdown,
  getRepoActivity,
} from "@/lib/api/analytics";

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const range = searchParams.get("range") || "week";

  let start: Date;
  const end = endOfDay(new Date());

  switch (range) {
    case "today":
      start = startOfDay(new Date());
      break;
    case "week":
      start = startOfDay(subDays(new Date(), 7));
      break;
    case "month":
      start = startOfDay(subDays(new Date(), 30));
      break;
    case "year":
      start = startOfDay(subDays(new Date(), 365));
      break;
    default:
      start = startOfDay(subDays(new Date(), 7));
  }

  const dateRange = { start, end };

  const [
    taskMetrics,
    tasksByStatus,
    dailyCompletions,
    tokenUsage,
    costBreakdown,
    repoActivity,
  ] = await Promise.all([
    getTaskMetrics(session.user.id, dateRange),
    getTasksByStatus(session.user.id, dateRange),
    getDailyCompletions(session.user.id, dateRange),
    getTokenUsage(session.user.id, dateRange),
    getCostBreakdown(session.user.id, dateRange),
    getRepoActivity(session.user.id, dateRange),
  ]);

  return NextResponse.json({
    taskMetrics,
    tasksByStatus,
    dailyCompletions,
    tokenUsage,
    costBreakdown,
    repoActivity,
    dateRange: { start: start.toISOString(), end: end.toISOString() },
  });
}
```

**Step 2: Commit**

```bash
git add app/api/analytics/route.ts
git commit -m "feat: add analytics API endpoint"
```

---

### Task 13: Create Analytics Chart Components

**Files:**
- Create: `components/analytics/tasks-by-status-chart.tsx`
- Create: `components/analytics/completion-trend-chart.tsx`
- Create: `components/analytics/token-usage-chart.tsx`

**Step 1: Create tasks by status chart**

```typescript
"use client";

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";

interface TasksByStatusChartProps {
  data: Array<{ status: string; count: number }>;
}

const statusColors: Record<string, string> = {
  done: "#22c55e",
  executing: "#3b82f6",
  ready: "#8b5cf6",
  planning: "#f59e0b",
  brainstorming: "#06b6d4",
  todo: "#6b7280",
  stuck: "#ef4444",
};

const statusLabels: Record<string, string> = {
  done: "Done",
  executing: "Executing",
  ready: "Ready",
  planning: "Planning",
  brainstorming: "Brainstorm",
  todo: "Todo",
  stuck: "Stuck",
};

export function TasksByStatusChart({ data }: TasksByStatusChartProps) {
  const chartData = data.map(d => ({
    name: statusLabels[d.status] || d.status,
    value: d.count,
    status: d.status,
  }));

  return (
    <div className="p-6 rounded-xl border bg-card">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Tasks by Status</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical">
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={statusColors[entry.status] || "#6b7280"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

**Step 2: Create completion trend chart**

Create `components/analytics/completion-trend-chart.tsx`:

```typescript
"use client";

import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { format, parseISO } from "date-fns";

interface CompletionTrendChartProps {
  data: Array<{ date: string; completed: number }>;
}

export function CompletionTrendChart({ data }: CompletionTrendChartProps) {
  const chartData = data.map(d => ({
    date: format(parseISO(d.date), "MMM d"),
    completed: d.completed,
  }));

  return (
    <div className="p-6 rounded-xl border bg-card">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Completion Trend</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="completed"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ fill: "hsl(var(--primary))", r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

**Step 3: Create token usage chart**

Create `components/analytics/token-usage-chart.tsx`:

```typescript
"use client";

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Legend } from "recharts";

interface TokenUsageChartProps {
  data: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    avgPerTask: number;
  };
}

function formatTokens(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
  return num.toString();
}

export function TokenUsageChart({ data }: TokenUsageChartProps) {
  const chartData = [
    { name: "Input", value: data.inputTokens },
    { name: "Output", value: data.outputTokens },
  ];

  return (
    <div className="p-6 rounded-xl border bg-card">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Token Consumption</h3>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical">
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 12 }} />
            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 pt-4 border-t space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total</span>
          <span className="font-medium">{formatTokens(data.totalTokens)} tokens</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Avg per task</span>
          <span className="font-medium">{formatTokens(data.avgPerTask)} tokens</span>
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add components/analytics/
git commit -m "feat: add analytics chart components"
```

---

### Task 14: Create Cost Breakdown and Repo Activity Components

**Files:**
- Create: `components/analytics/cost-breakdown.tsx`
- Create: `components/analytics/repo-activity-table.tsx`

**Step 1: Create cost breakdown component**

```typescript
interface CostBreakdownProps {
  data: {
    totalCents: number;
    inputCostCents: number;
    outputCostCents: number;
    avgPerTaskCents: number;
  };
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function CostBreakdown({ data }: CostBreakdownProps) {
  return (
    <div className="p-6 rounded-xl border bg-card">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Cost Breakdown</h3>
      <div className="space-y-3">
        <div className="flex justify-between items-baseline">
          <span className="text-muted-foreground">This period</span>
          <span className="text-2xl font-bold">{formatCents(data.totalCents)}</span>
        </div>
        <div className="h-px bg-border" />
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Input tokens</span>
          <span>{formatCents(data.inputCostCents)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Output tokens</span>
          <span>{formatCents(data.outputCostCents)}</span>
        </div>
        <div className="h-px bg-border" />
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Avg per task</span>
          <span className="font-medium">{formatCents(data.avgPerTaskCents)}</span>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Create repo activity table**

Create `components/analytics/repo-activity-table.tsx`:

```typescript
interface RepoActivityTableProps {
  data: Array<{
    repoId: string;
    repoName: string;
    commits: number;
    tasksCompleted: number;
  }>;
}

export function RepoActivityTable({ data }: RepoActivityTableProps) {
  if (data.length === 0) {
    return (
      <div className="p-6 rounded-xl border bg-card">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">Repository Activity</h3>
        <p className="text-sm text-muted-foreground text-center py-8">
          No repository activity in this period.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-xl border bg-card">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Repository Activity</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 font-medium text-muted-foreground">Repository</th>
              <th className="text-right py-2 font-medium text-muted-foreground">Commits</th>
              <th className="text-right py-2 font-medium text-muted-foreground">Tasks</th>
            </tr>
          </thead>
          <tbody>
            {data.map((repo) => (
              <tr key={repo.repoId} className="border-b last:border-0">
                <td className="py-2 font-medium">{repo.repoName}</td>
                <td className="py-2 text-right">{repo.commits}</td>
                <td className="py-2 text-right">{repo.tasksCompleted}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Step 3: Create barrel export**

Create `components/analytics/index.ts`:

```typescript
export { TasksByStatusChart } from "./tasks-by-status-chart";
export { CompletionTrendChart } from "./completion-trend-chart";
export { TokenUsageChart } from "./token-usage-chart";
export { CostBreakdown } from "./cost-breakdown";
export { RepoActivityTable } from "./repo-activity-table";
```

**Step 4: Commit**

```bash
git add components/analytics/
git commit -m "feat: add cost breakdown and repo activity components"
```

---

### Task 15: Create Analytics Page

**Files:**
- Create: `app/(dashboard)/analytics/page.tsx`

**Step 1: Create the analytics page**

```typescript
"use client";

import { useState, useEffect } from "react";
import { StatCard } from "@/components/dashboard";
import {
  TasksByStatusChart,
  CompletionTrendChart,
  TokenUsageChart,
  CostBreakdown,
  RepoActivityTable,
} from "@/components/analytics";
import { Button } from "@/components/ui/button";
import { ListTodo, CheckCircle2, TrendingUp, Clock, Download } from "lucide-react";

type DateRange = "today" | "week" | "month" | "year";

interface AnalyticsData {
  taskMetrics: {
    total: number;
    completed: number;
    executing: number;
    stuck: number;
    successRate: number;
    avgCompletionTimeMinutes: number | null;
  };
  tasksByStatus: Array<{ status: string; count: number }>;
  dailyCompletions: Array<{ date: string; completed: number }>;
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    avgPerTask: number;
  };
  costBreakdown: {
    totalCents: number;
    inputCostCents: number;
    outputCostCents: number;
    avgPerTaskCents: number;
  };
  repoActivity: Array<{
    repoId: string;
    repoName: string;
    commits: number;
    tasksCompleted: number;
  }>;
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<DateRange>("week");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);
      try {
        const res = await fetch(`/api/analytics?range=${range}`);
        if (res.ok) {
          setData(await res.json());
        }
      } catch (error) {
        console.error("Failed to fetch analytics:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, [range]);

  const handleExport = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `loopforge-analytics-${range}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Failed to load analytics.</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">
            Track your AI-powered development metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border rounded-lg overflow-hidden">
            {(["today", "week", "month", "year"] as DateRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-sm capitalize ${
                  range === r
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                }`}
              >
                {r === "today" ? "Today" : `This ${r}`}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Task Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Total Tasks"
          value={data.taskMetrics.total}
          icon={ListTodo}
        />
        <StatCard
          title="Completed"
          value={data.taskMetrics.completed}
          icon={CheckCircle2}
        />
        <StatCard
          title="Success Rate"
          value={`${data.taskMetrics.successRate}%`}
          icon={TrendingUp}
        />
        <StatCard
          title="Avg Time"
          value={data.taskMetrics.avgCompletionTimeMinutes
            ? `${data.taskMetrics.avgCompletionTimeMinutes}min`
            : "N/A"}
          icon={Clock}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-4 md:grid-cols-2 mb-8">
        <TasksByStatusChart data={data.tasksByStatus} />
        <CompletionTrendChart data={data.dailyCompletions} />
      </div>

      {/* AI Usage Section */}
      <h2 className="text-lg font-semibold mb-4">AI Usage</h2>
      <div className="grid gap-4 md:grid-cols-2 mb-8">
        <TokenUsageChart data={data.tokenUsage} />
        <CostBreakdown data={data.costBreakdown} />
      </div>

      {/* Repository Activity */}
      <h2 className="text-lg font-semibold mb-4">Repository Activity</h2>
      <RepoActivityTable data={data.repoActivity} />
    </div>
  );
}
```

**Step 2: Verify page renders**

Run: `npm run dev`
Navigate to: `http://localhost:3000/analytics`
Expected: Analytics page displays with charts and metrics

**Step 3: Commit**

```bash
git add app/\(dashboard\)/analytics/page.tsx
git commit -m "feat: add analytics page with charts and metrics"
```

---

## Phase 6: Settings Page

### Task 16: Create Settings Tab Components

**Files:**
- Create: `components/settings/account-tab.tsx`
- Create: `components/settings/preferences-tab.tsx`
- Create: `components/settings/integrations-tab.tsx`
- Create: `components/settings/danger-zone-tab.tsx`

**Step 1: Create account tab**

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Key, CreditCard } from "lucide-react";

interface AccountTabProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  apiKeyMasked?: string | null;
  subscription?: {
    plan: string;
    usage: number;
    limit: number;
    nextBilling?: string;
  } | null;
}

export function AccountTab({ user, apiKeyMasked, subscription }: AccountTabProps) {
  const [showUpdateKey, setShowUpdateKey] = useState(false);
  const [newApiKey, setNewApiKey] = useState("");

  return (
    <div className="space-y-6">
      {/* Profile */}
      <div className="p-6 rounded-xl border bg-card">
        <h3 className="font-semibold mb-4">Profile</h3>
        <div className="flex items-center gap-4">
          {user.image ? (
            <img src={user.image} alt={user.name || ""} className="w-16 h-16 rounded-full" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-xl font-semibold">
              {user.name?.[0] || "U"}
            </div>
          )}
          <div>
            <p className="font-semibold text-lg">{user.name}</p>
            <p className="text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </div>

      {/* API Key */}
      <div className="p-6 rounded-xl border bg-card">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-4 h-4" />
          <h3 className="font-semibold">API Key</h3>
        </div>
        {apiKeyMasked ? (
          <div className="space-y-3">
            <p className="font-mono text-sm bg-muted px-3 py-2 rounded">{apiKeyMasked}</p>
            {showUpdateKey ? (
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="sk-ant-api03-..."
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button size="sm">Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowUpdateKey(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowUpdateKey(true)}>
                  Update API Key
                </Button>
                <Button size="sm" variant="outline" className="text-destructive">
                  Remove Key
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">No API key configured.</p>
            <Input
              type="password"
              placeholder="sk-ant-api03-..."
              value={newApiKey}
              onChange={(e) => setNewApiKey(e.target.value)}
            />
            <Button size="sm">Save API Key</Button>
          </div>
        )}
      </div>

      {/* Subscription */}
      <div className="p-6 rounded-xl border bg-card">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-4 h-4" />
          <h3 className="font-semibold">Billing & Subscription</h3>
        </div>
        {subscription ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">Current plan: {subscription.plan}</p>
                {subscription.nextBilling && (
                  <p className="text-sm text-muted-foreground">
                    Next billing: {subscription.nextBilling}
                  </p>
                )}
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Usage: {subscription.usage}/{subscription.limit} tasks</span>
                <span>{Math.round((subscription.usage / subscription.limit) * 100)}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${(subscription.usage / subscription.limit) * 100}%` }}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline">Manage Subscription</Button>
              <Button size="sm" variant="outline">View Invoices</Button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              You&apos;re using Bring Your Own Key mode. Upgrade for managed billing.
            </p>
            <Button size="sm">Upgrade Plan</Button>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Create preferences tab**

Create `components/settings/preferences-tab.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Monitor } from "lucide-react";

type Theme = "light" | "dark" | "system";

export function PreferencesTab() {
  const [theme, setTheme] = useState<Theme>("system");
  const [notifications, setNotifications] = useState({
    taskCompleted: true,
    taskStuck: true,
    weeklySummary: false,
    browser: true,
  });

  return (
    <div className="space-y-6">
      {/* Appearance */}
      <div className="p-6 rounded-xl border bg-card">
        <h3 className="font-semibold mb-4">Appearance</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Theme</label>
            <div className="flex gap-2">
              {([
                { value: "light", icon: Sun, label: "Light" },
                { value: "dark", icon: Moon, label: "Dark" },
                { value: "system", icon: Monitor, label: "System" },
              ] as const).map(({ value, icon: Icon, label }) => (
                <Button
                  key={value}
                  variant={theme === value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme(value)}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="p-6 rounded-xl border bg-card">
        <h3 className="font-semibold mb-4">Notifications</h3>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Email notifications</p>
          {[
            { key: "taskCompleted", label: "Task completed" },
            { key: "taskStuck", label: "Task stuck (needs attention)" },
            { key: "weeklySummary", label: "Weekly summary" },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm">{label}</span>
              <button
                onClick={() => setNotifications(prev => ({
                  ...prev,
                  [key]: !prev[key as keyof typeof prev]
                }))}
                className={`w-10 h-6 rounded-full transition-colors ${
                  notifications[key as keyof typeof notifications]
                    ? "bg-primary"
                    : "bg-muted"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    notifications[key as keyof typeof notifications]
                      ? "translate-x-5"
                      : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          ))}
          <div className="h-px bg-border" />
          <div className="flex items-center justify-between">
            <span className="text-sm">Browser notifications</span>
            <button
              onClick={() => setNotifications(prev => ({ ...prev, browser: !prev.browser }))}
              className={`w-10 h-6 rounded-full transition-colors ${
                notifications.browser ? "bg-primary" : "bg-muted"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  notifications.browser ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Default Behaviors */}
      <div className="p-6 rounded-xl border bg-card">
        <h3 className="font-semibold mb-4">Default Behaviors</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Default branch prefix</label>
            <select className="w-full px-3 py-2 rounded-md border bg-background text-sm">
              <option value="loopforge/">loopforge/</option>
              <option value="ai/">ai/</option>
              <option value="feature/">feature/</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Require plan approval before execution</span>
            <button className="w-10 h-6 rounded-full bg-primary">
              <div className="w-4 h-4 rounded-full bg-white translate-x-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Create integrations tab**

Create `components/settings/integrations-tab.tsx`:

```typescript
"use client";

import { Button } from "@/components/ui/button";
import { Check, Lock, Globe, Bell } from "lucide-react";

interface IntegrationsTabProps {
  github: {
    username: string;
    connectedAt: string;
  };
  repos: Array<{
    id: string;
    fullName: string;
    isPrivate: boolean;
  }>;
}

export function IntegrationsTab({ github, repos }: IntegrationsTabProps) {
  return (
    <div className="space-y-6">
      {/* GitHub Connection */}
      <div className="p-6 rounded-xl border bg-card">
        <h3 className="font-semibold mb-4">GitHub Connection</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <Check className="w-4 h-4" />
            <span>Connected as @{github.username}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Permissions: read:user, user:email, repo
          </p>
          <p className="text-sm text-muted-foreground">
            Connected: {github.connectedAt}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline">Reconnect</Button>
            <Button size="sm" variant="outline" className="text-destructive">
              Revoke Access
            </Button>
          </div>
        </div>
      </div>

      {/* Connected Repositories */}
      <div className="p-6 rounded-xl border bg-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Connected Repositories</h3>
          <Button size="sm" variant="outline">+ Add Repos</Button>
        </div>
        <div className="space-y-2">
          {repos.map((repo) => (
            <div
              key={repo.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{repo.fullName}</span>
                {repo.isPrivate ? (
                  <Lock className="w-3 h-3 text-muted-foreground" />
                ) : (
                  <Globe className="w-3 h-3 text-muted-foreground" />
                )}
              </div>
              <Button size="sm" variant="ghost" className="text-destructive text-xs">
                Disconnect
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Webhooks */}
      <div className="p-6 rounded-xl border bg-card opacity-60">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-4 h-4" />
          <h3 className="font-semibold">Webhooks</h3>
          <span className="text-xs bg-muted px-2 py-0.5 rounded">Coming Soon</span>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Configure webhooks to notify external services when tasks complete or encounter errors.
        </p>
        <Button size="sm" variant="outline" disabled>
          Notify me when available
        </Button>
      </div>
    </div>
  );
}
```

**Step 4: Create danger zone tab**

Create `components/settings/danger-zone-tab.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Download, Unplug, Trash2 } from "lucide-react";

export function DangerZoneTab() {
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-xl border-2 border-destructive/50 bg-destructive/5">
        <div className="flex items-center gap-2 mb-4 text-destructive">
          <AlertTriangle className="w-5 h-5" />
          <h3 className="font-semibold">Danger Zone</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          These actions are irreversible. Please proceed with caution.
        </p>

        <div className="space-y-4">
          {/* Export Data */}
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 font-medium">
                  <Download className="w-4 h-4" />
                  Export All Data
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Download all your tasks, executions, and settings
                </p>
              </div>
              <Button variant="outline" size="sm">
                Export JSON
              </Button>
            </div>
          </div>

          {/* Disconnect All */}
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 font-medium">
                  <Unplug className="w-4 h-4" />
                  Disconnect All Repositories
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Remove all connected repos. Tasks will be preserved.
                </p>
              </div>
              <Button variant="outline" size="sm" className="text-destructive">
                Disconnect All
              </Button>
            </div>
          </div>

          {/* Delete Account */}
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 font-medium text-destructive">
                  <Trash2 className="w-4 h-4" />
                  Delete Account
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Permanently delete your account and all associated data
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
              >
                Delete Account
              </Button>
            </div>

            {showDeleteDialog && (
              <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                <p className="text-sm font-medium mb-2">
                  Type &quot;DELETE MY ACCOUNT&quot; to confirm:
                </p>
                <Input
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="DELETE MY ACCOUNT"
                  className="mb-3"
                />
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={deleteConfirm !== "DELETE MY ACCOUNT"}
                  >
                    Confirm Delete
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowDeleteDialog(false);
                      setDeleteConfirm("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 5: Create barrel export**

Create `components/settings/index.ts`:

```typescript
export { AccountTab } from "./account-tab";
export { PreferencesTab } from "./preferences-tab";
export { IntegrationsTab } from "./integrations-tab";
export { DangerZoneTab } from "./danger-zone-tab";
```

**Step 6: Commit**

```bash
git add components/settings/
git commit -m "feat: add settings tab components"
```

---

### Task 17: Create Settings Page

**Files:**
- Create: `app/(dashboard)/settings/page.tsx`

**Step 1: Create the settings page**

```typescript
"use client";

import { useState, useEffect } from "react";
import { AccountTab, PreferencesTab, IntegrationsTab, DangerZoneTab } from "@/components/settings";
import { User, Sliders, Plug, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "account" | "preferences" | "integrations" | "danger";

const tabs = [
  { id: "account" as const, label: "Account", icon: User },
  { id: "preferences" as const, label: "Preferences", icon: Sliders },
  { id: "integrations" as const, label: "Integrations", icon: Plug },
  { id: "danger" as const, label: "Danger Zone", icon: AlertTriangle },
];

interface SettingsData {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  apiKeyMasked?: string | null;
  subscription?: {
    plan: string;
    usage: number;
    limit: number;
    nextBilling?: string;
  } | null;
  github: {
    username: string;
    connectedAt: string;
  };
  repos: Array<{
    id: string;
    fullName: string;
    isPrivate: boolean;
  }>;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("account");
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          setData(await res.json());
        }
      } catch (error) {
        console.error("Failed to fetch settings:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Fallback data for development
  const settingsData = data || {
    user: { name: "User", email: "user@example.com", image: null },
    apiKeyMasked: "sk-ant-•••••••••••••3kF",
    subscription: null,
    github: { username: "user", connectedAt: "January 2025" },
    repos: [],
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "account" && (
        <AccountTab
          user={settingsData.user}
          apiKeyMasked={settingsData.apiKeyMasked}
          subscription={settingsData.subscription}
        />
      )}
      {activeTab === "preferences" && <PreferencesTab />}
      {activeTab === "integrations" && (
        <IntegrationsTab
          github={settingsData.github}
          repos={settingsData.repos}
        />
      )}
      {activeTab === "danger" && <DangerZoneTab />}
    </div>
  );
}
```

**Step 2: Create settings API route**

Create `app/api/settings/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, users, repos, userSubscriptions, subscriptionPlans } from "@/lib/db";
import { eq } from "drizzle-orm";
import { format } from "date-fns";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Get user repos
  const userRepos = await db.query.repos.findMany({
    where: eq(repos.userId, session.user.id),
  });

  // Get subscription if managed user
  let subscription = null;
  if (user.billingMode === "managed") {
    const sub = await db.query.userSubscriptions.findFirst({
      where: eq(userSubscriptions.userId, session.user.id),
      with: { plan: true },
    });
    if (sub) {
      // Count tasks this period
      const periodTasks = await db.query.tasks.findMany({
        where: (tasks, { inArray, and, gte }) => {
          const repoIds = userRepos.map(r => r.id);
          return and(
            inArray(tasks.repoId, repoIds),
            gte(tasks.createdAt, sub.currentPeriodStart)
          );
        },
      });
      subscription = {
        plan: sub.plan?.displayName || "Unknown",
        usage: periodTasks.filter(t => t.status === "done").length,
        limit: sub.plan?.taskLimit || 30,
        nextBilling: format(sub.currentPeriodEnd, "MMM d, yyyy"),
      };
    }
  }

  // Mask API key if present
  const apiKeyMasked = user.encryptedApiKey
    ? `sk-ant-•••••••••••••${user.encryptedApiKey.slice(-3)}`
    : null;

  return NextResponse.json({
    user: {
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
    },
    apiKeyMasked,
    subscription,
    github: {
      username: user.username,
      connectedAt: format(user.createdAt, "MMMM yyyy"),
    },
    repos: userRepos.map(r => ({
      id: r.id,
      fullName: r.fullName,
      isPrivate: r.isPrivate,
    })),
  });
}
```

**Step 3: Verify page renders**

Run: `npm run dev`
Navigate to: `http://localhost:3000/settings`
Expected: Settings page displays with all 4 tabs working

**Step 4: Commit**

```bash
git add app/\(dashboard\)/settings/page.tsx app/api/settings/route.ts
git commit -m "feat: add settings page with account, preferences, integrations, danger zone"
```

---

## Phase 7: Final Verification

### Task 18: Run Type Check and Tests

**Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 2: Run tests**

Run: `npm run test:run`
Expected: All tests pass

**Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup for dashboard redesign"
```

---

## Summary

**Total Tasks:** 18 tasks across 7 phases

**Files Created:**
- `components/dashboard/stat-card.tsx`
- `components/dashboard/activity-feed.tsx`
- `components/dashboard/welcome-banner.tsx`
- `components/dashboard/repo-card-expandable.tsx`
- `components/dashboard/index.ts`
- `components/analytics/tasks-by-status-chart.tsx`
- `components/analytics/completion-trend-chart.tsx`
- `components/analytics/token-usage-chart.tsx`
- `components/analytics/cost-breakdown.tsx`
- `components/analytics/repo-activity-table.tsx`
- `components/analytics/index.ts`
- `components/settings/account-tab.tsx`
- `components/settings/preferences-tab.tsx`
- `components/settings/integrations-tab.tsx`
- `components/settings/danger-zone-tab.tsx`
- `components/settings/index.ts`
- `lib/api/analytics.ts`
- `app/api/analytics/route.ts`
- `app/api/settings/route.ts`
- `app/(dashboard)/analytics/page.tsx`
- `app/(dashboard)/settings/page.tsx`

**Files Modified:**
- `package.json`
- `next.config.ts`
- `components/sidebar.tsx`
- `app/(dashboard)/page.tsx`
- `app/(auth)/onboarding/page.tsx`
- `app/api/onboarding/complete/route.ts`
