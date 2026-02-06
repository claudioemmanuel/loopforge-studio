import { auth } from "@/lib/auth";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  GitBranch,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { AddRepoButton } from "@/components/dashboard";
import { RepoStatusDot } from "@/components/repo-status-indicator";
import { formatDistanceToNow } from "date-fns";
import { getDashboardData } from "@/lib/contexts/dashboard/api";

export default async function RepositoriesPage() {
  const t = await getTranslations("repositories");
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const userId = session.user.id;

  const {
    repos: userRepos,
    allTasks,
    existingRepoGithubIds,
  } = await getDashboardData(userId);

  // Calculate task counts per repo
  const reposWithCounts = userRepos.map((repo) => {
    const repoTasks = allTasks.filter((t) => t.repoId === repo.id);
    const completed = repoTasks.filter((t) => t.status === "done").length;
    const inProgress = repoTasks.filter((t) =>
      ["executing", "brainstorming", "planning", "ready"].includes(t.status),
    ).length;
    const stuck = repoTasks.filter((t) => t.status === "stuck").length;

    return {
      ...repo,
      taskCount: repoTasks.length,
      completedCount: completed,
      inProgressCount: inProgress,
      stuckCount: stuck,
    };
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <AddRepoButton existingRepoGithubIds={existingRepoGithubIds} />
      </div>

      {userRepos.length === 0 ? (
        <div className="max-w-md mx-auto text-center py-12">
          <h2 className="text-2xl font-serif font-semibold tracking-tight mb-2">
            {t("noRepos")}
          </h2>
          <p className="text-muted-foreground mb-4">{t("noReposMessage")}</p>
          <Link href="/onboarding">
            <Button>{t("getStarted")}</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reposWithCounts.map((repo) => (
            <Link key={repo.id} href={`/repos/${repo.id}`}>
              <Card className="p-6 hover:bg-accent/50 transition-colors cursor-pointer h-full">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-5 h-5 text-muted-foreground" />
                    <h3 className="font-semibold truncate">{repo.name}</h3>
                  </div>
                  <RepoStatusDot
                    isCloned={repo.isCloned}
                    indexingStatus={
                      (repo.indexingStatus || "pending") as
                        | "pending"
                        | "indexing"
                        | "indexed"
                        | "failed"
                    }
                  />
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {formatDistanceToNow(new Date(repo.updatedAt), {
                      addSuffix: true,
                    })}
                  </div>
                  {repo.isPrivate && (
                    <span className="px-2 py-0.5 rounded-full bg-muted text-xs">
                      {t("private")}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <span className="font-medium">{repo.taskCount}</span>
                    <span className="text-muted-foreground">{t("tasks")}</span>
                  </div>
                  {repo.completedCount > 0 && (
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{repo.completedCount}</span>
                    </div>
                  )}
                  {repo.inProgressCount > 0 && (
                    <div className="flex items-center gap-1 text-blue-600">
                      <Loader2 className="w-3.5 h-3.5" />
                      <span>{repo.inProgressCount}</span>
                    </div>
                  )}
                  {repo.stuckCount > 0 && (
                    <div className="flex items-center gap-1 text-amber-600">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{repo.stuckCount}</span>
                    </div>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
