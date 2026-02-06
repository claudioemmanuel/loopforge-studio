import { getRepositoryService } from "@/lib/contexts/repository/api";
import { getTaskService } from "@/lib/contexts/task/api";
import type { IndexingStatus, Task } from "@/lib/db/schema";

function toSidebarCloneStatus(
  value: string | null,
): "pending" | "cloning" | "completed" | "failed" | undefined {
  if (value === "cloning" || value === "failed") {
    return value;
  }

  if (value === "cloned" || value === "completed") {
    return "completed";
  }

  if (value === "not_cloned" || value === "pending" || value === "updating") {
    return "pending";
  }

  return undefined;
}

export async function getDashboardLayoutData(userId: string): Promise<
  Array<{
    id: string;
    name: string;
    fullName: string;
    taskCount: number;
    isCloned: boolean;
    indexingStatus: IndexingStatus;
    cloneStatus?: "pending" | "cloning" | "completed" | "failed";
  }>
> {
  const repositoryService = getRepositoryService();
  const taskService = getTaskService();

  const repos = await repositoryService.listUserRepositories(userId);
  const sorted = [...repos].sort((a, b) => a.name.localeCompare(b.name));

  const result: Array<{
    id: string;
    name: string;
    fullName: string;
    taskCount: number;
    isCloned: boolean;
    indexingStatus: IndexingStatus;
    cloneStatus?: "pending" | "cloning" | "completed" | "failed";
  }> = [];

  for (const repo of sorted) {
    const repoTasks = await taskService.listByRepo(repo.id);
    result.push({
      id: repo.id,
      name: repo.name,
      fullName: repo.fullName,
      taskCount: repoTasks.length,
      isCloned: repo.cloneStatus === "cloned",
      indexingStatus: (repo.indexingStatus ?? "pending") as IndexingStatus,
      cloneStatus: toSidebarCloneStatus(repo.cloneStatus),
    });
  }

  return result;
}

export async function getDashboardData(userId: string): Promise<{
  repos: Array<{
    id: string;
    name: string;
    fullName: string;
    githubRepoId: string;
    defaultBranch: string;
    isPrivate: boolean;
    updatedAt: Date;
    createdAt: Date;
    indexingStatus: string | null;
    cloneStatus: string | null;
    localPath: string | null;
    isCloned: boolean;
  }>;
  allTasks: Task[];
  existingRepoGithubIds: number[];
}> {
  const repositoryService = getRepositoryService();
  const taskService = getTaskService();

  const repos = await repositoryService.listUserRepositories(userId);
  const repoIds = repos.map((repo) => repo.id);

  const taskIds = await taskService.getIdsByRepoIds(repoIds);
  const allTasks = [...(await taskService.listByIds(taskIds))].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  );

  const sortedRepos = [...repos].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  );

  return {
    repos: sortedRepos.map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.fullName,
      githubRepoId: repo.githubRepoId,
      defaultBranch: repo.defaultBranch || "main",
      isPrivate: repo.isPrivate,
      updatedAt: repo.updatedAt,
      createdAt: repo.createdAt,
      indexingStatus: repo.indexingStatus,
      cloneStatus: repo.cloneStatus,
      localPath: repo.localPath,
      isCloned: repo.cloneStatus === "cloned",
    })),
    allTasks,
    existingRepoGithubIds: sortedRepos
      .map((repo) => parseInt(repo.githubRepoId, 10))
      .filter((id) => !Number.isNaN(id)),
  };
}
