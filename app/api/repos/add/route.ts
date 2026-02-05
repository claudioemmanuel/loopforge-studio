import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/middleware";
import { db, repos } from "@/lib/db";
import { apiLogger } from "@/lib/logger";
import { eq } from "drizzle-orm";

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

    // Use database transaction with row locking to prevent race conditions
    const result = await db.transaction(async (tx) => {
      // Create repo records using atomic upsert to prevent duplicates
      const repoIds: string[] = [];
      const addedRepos: string[] = [];
      const skippedRepos: string[] = [];

      for (const repoData of reposToAdd) {
        const repoId = crypto.randomUUID();

        try {
          // Use atomic insert with ON CONFLICT DO NOTHING to prevent duplicates
          // The unique constraint on (userId, githubRepoId) ensures atomicity
          const insertResult = await tx
            .insert(repos)
            .values({
              id: repoId,
              userId: user.id,
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

          if (insertResult.length > 0) {
            // New repo was inserted
            repoIds.push(insertResult[0].id);
            addedRepos.push(repoData.full_name);
          } else {
            // Conflict - repo already exists, skip
            skippedRepos.push(repoData.full_name);
          }
        } catch (insertError: unknown) {
          throw insertError;
        }
      }

      return { repoIds, addedRepos, skippedRepos };
    });

    return NextResponse.json({
      ...result,
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
