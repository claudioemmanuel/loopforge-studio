import { auth } from "@/lib/auth";
import { db, repos, tasks } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatCard, ActivityFeed, WelcomeBanner, RepoCardExpandable } from "@/components/dashboard";
import { ListTodo, CheckCircle2, Zap, TrendingUp, Sparkles } from "lucide-react";

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
          <h1 className="text-3xl font-serif font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, <em className="font-serif">{session.user.name?.split(" ")[0] || "there"}</em>
          </p>
        </div>
        <Link href="/onboarding">
          <Button>Add Repository</Button>
        </Link>
      </div>

      {/* Tip Banner */}
      <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20 mb-6">
        <Sparkles className="w-5 h-5 text-primary flex-shrink-0" />
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Tip:</span> Click on a repository to open its Kanban board and create your first AI-powered task.
        </p>
      </div>

      {showWelcome && userRepos.length > 0 && (
        <WelcomeBanner repoCount={userRepos.length} />
      )}

      {userRepos.length === 0 ? (
        <div className="max-w-md mx-auto text-center py-12">
          <h2 className="text-2xl font-serif font-semibold tracking-tight mb-2">No repositories yet</h2>
          <p className="text-muted-foreground mb-4">
            Add your first repository to start using <em className="font-serif">Loopforge</em>
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
            <h2 className="text-xl font-serif font-semibold tracking-tight">Your Repositories</h2>
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
