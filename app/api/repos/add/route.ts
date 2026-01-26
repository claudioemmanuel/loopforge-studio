import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, repos } from "@/lib/db";
import { apiLogger } from "@/lib/logger";

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

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: AddReposRequest = await request.json();
    const { repos: reposToAdd } = body;

    if (!reposToAdd || reposToAdd.length === 0) {
      return NextResponse.json(
        { error: "At least one repository is required" },
        { status: 400 },
      );
    }

    // Create repo records using atomic upsert to prevent race condition duplicates
    const repoIds: string[] = [];
    const addedRepos: string[] = [];
    const skippedRepos: string[] = [];

    for (const repoData of reposToAdd) {
      const repoId = crypto.randomUUID();

      // Use atomic insert with ON CONFLICT DO NOTHING to prevent duplicates
      // The unique constraint on (userId, githubRepoId) ensures atomicity
      const result = await db
        .insert(repos)
        .values({
          id: repoId,
          userId: session.user.id,
          githubRepoId: String(repoData.id),
          name: repoData.name,
          fullName: repoData.full_name,
          defaultBranch: repoData.default_branch,
          cloneUrl: repoData.clone_url,
          isPrivate: repoData.private,
        })
        .onConflictDoNothing({
          target: [repos.userId, repos.githubRepoId],
        })
        .returning({ id: repos.id });

      if (result.length > 0) {
        // New repo was inserted
        repoIds.push(result[0].id);
        addedRepos.push(repoData.full_name);
      } else {
        // Conflict - repo already exists, skip
        skippedRepos.push(repoData.full_name);
      }
    }

    return NextResponse.json({
      repoIds,
      addedRepos,
      skippedRepos,
      success: true,
    });
  } catch (error) {
    apiLogger.error({ error }, "Error adding repositories");
    return NextResponse.json(
      { error: "Failed to add repositories" },
      { status: 500 },
    );
  }
}
