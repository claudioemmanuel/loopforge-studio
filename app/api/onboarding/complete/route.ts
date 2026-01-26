import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, users, repos } from "@/lib/db";
import { encryptApiKey } from "@/lib/crypto";
import { eq } from "drizzle-orm";

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  clone_url: string;
}

interface CompleteOnboardingRequest {
  // Support both single repo (legacy) and multiple repos
  repo?: GitHubRepo;
  repos?: GitHubRepo[];
  apiKey: string; // Required for BYOK (only mode now)
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: CompleteOnboardingRequest = await request.json();
    const { repo, repos: reposList, apiKey } = body;

    // Normalize to array (support both single repo and multiple repos)
    const reposToAdd = reposList || (repo ? [repo] : []);

    if (reposToAdd.length === 0) {
      return NextResponse.json(
        { error: "At least one repository is required" },
        { status: 400 }
      );
    }

    // API key is required for BYOK (only mode)
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
    }

    // Update user with encrypted API key
    const encrypted = encryptApiKey(apiKey);
    await db
      .update(users)
      .set({
        encryptedApiKey: encrypted.encrypted,
        apiKeyIv: encrypted.iv,
        onboardingCompleted: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id));

    // Create repo records using atomic upsert to prevent race condition duplicates
    const repoIds: string[] = [];
    for (const repoData of reposToAdd) {
      const repoId = crypto.randomUUID();

      // Use atomic insert with ON CONFLICT to handle duplicates atomically
      // Returns the inserted row if new, otherwise returns nothing on conflict
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
      } else {
        // Conflict - repo already exists, fetch existing ID
        const existingRepo = await db.query.repos.findFirst({
          where: eq(repos.githubRepoId, String(repoData.id)),
          columns: { id: true },
        });
        if (existingRepo) {
          repoIds.push(existingRepo.id);
        }
      }
    }

    // Return the first repo ID for redirect
    return NextResponse.json({
      repoId: repoIds[0],
      repoIds,
      success: true,
    });
  } catch (error) {
    console.error("Error completing onboarding:", error);
    return NextResponse.json(
      { error: "Failed to complete onboarding" },
      { status: 500 }
    );
  }
}
