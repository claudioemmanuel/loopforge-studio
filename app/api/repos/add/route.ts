import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/middleware";
import { apiLogger } from "@/lib/logger";
import { getRepositoryService } from "@/lib/contexts/repository/api";

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  clone_url: string;
}

interface AddReposRequest {
  repos: GitHubRepo[];
}

export const POST = withAuth(async (request, { user }) => {
  try {
    const body: AddReposRequest = await request.json();
    const { repos: reposToAdd } = body;

    if (!reposToAdd || reposToAdd.length === 0) {
      return NextResponse.json(
        { error: "At least one repository is required" },
        { status: 400 },
      );
    }

    const repositoryService = getRepositoryService();
    const repoIds: string[] = [];
    const addedRepos: string[] = [];
    const skippedRepos: string[] = [];

    for (const repoData of reposToAdd) {
      const createdId = await repositoryService.connectRepository({
        userId: user.id,
        githubRepoId: String(repoData.id),
        name: repoData.name,
        fullName: repoData.full_name,
        defaultBranch: repoData.default_branch,
        cloneUrl: repoData.clone_url,
        isPrivate: repoData.private,
      });

      if (createdId) {
        repoIds.push(createdId);
        addedRepos.push(repoData.full_name);
        continue;
      }

      skippedRepos.push(repoData.full_name);
      const existing = await repositoryService.findByUserAndGithubId(
        user.id,
        String(repoData.id),
      );
      if (existing) {
        repoIds.push(existing.id);
      }
    }

    return NextResponse.json({
      repoIds,
      addedRepos,
      skippedRepos,
      success: true,
    });
  } catch (error: unknown) {
    apiLogger.error({ error }, "Error adding repositories");
    return NextResponse.json(
      { error: "Failed to add repositories" },
      { status: 500 },
    );
  }
});
