import { NextResponse } from "next/server";
import { withRepoLimit } from "@/lib/api/middleware";
import { db, repos, users } from "@/lib/db";
import { apiLogger } from "@/lib/logger";
import { eq, count } from "drizzle-orm";
import { getPlanConfig, type SubscriptionTier } from "@/lib/billing/domain";

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

export const POST = withRepoLimit(async (request, { user }) => {
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
      // Lock user row to prevent concurrent modifications
      const [userRow] = await tx
        .select()
        .from(users)
        .where(eq(users.id, user.id))
        .for("update"); // FOR UPDATE lock

      if (!userRow) {
        throw new Error("User not found");
      }

      // Get fresh count within transaction
      const repoCountResult = await tx
        .select({ count: count() })
        .from(repos)
        .where(eq(repos.userId, user.id));

      const currentCount = repoCountResult[0]?.count || 0;
      const tier = (userRow.subscriptionTier || "free") as SubscriptionTier;
      const plan = getPlanConfig(tier);
      const maxRepos = plan.maxRepos;

      // Check if adding repos would exceed limit (skip for unlimited)
      if (maxRepos !== -1) {
        if (currentCount >= maxRepos) {
          // Already at limit
          throw new Error(
            JSON.stringify({
              error: "repository_limit_reached",
              message: `You've reached the limit of ${maxRepos} repositories for the ${tier} plan. Upgrade to create more.`,
              current: currentCount,
              limit: maxRepos,
              tier,
              upgradeUrl: "/billing",
            }),
          );
        }

        if (currentCount + reposToAdd.length > maxRepos) {
          // Would exceed limit
          throw new Error(
            JSON.stringify({
              error: "repository_limit_exceeded",
              message: `Adding ${reposToAdd.length} repositories would exceed your limit of ${maxRepos} for the ${tier} plan. You currently have ${currentCount} repositories.`,
              current: currentCount,
              limit: maxRepos,
              tier,
              upgradeUrl: "/billing",
            }),
          );
        }
      }

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
          // Check for database constraint violation (23514 = check_violation)
          const pgError = insertError as { code?: string; message?: string };
          if (pgError.code === "23514") {
            throw new Error(
              JSON.stringify({
                error: "repository_limit_reached",
                message: pgError.message || "Repository limit exceeded",
                current: currentCount,
                limit: maxRepos,
                tier,
                upgradeUrl: "/billing",
              }),
            );
          }
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
    // Handle structured errors from transaction
    const err = error as { message?: string };
    if (err.message && err.message.startsWith("{")) {
      try {
        const errorData = JSON.parse(err.message);
        return NextResponse.json(errorData, { status: 402 });
      } catch {
        // Fall through to generic error
      }
    }

    apiLogger.error({ error }, "Error adding repositories");
    return NextResponse.json(
      { error: "Failed to add repositories" },
      { status: 500 },
    );
  }
});
