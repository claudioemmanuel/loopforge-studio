import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, repos } from "@/lib/db";
import { eq, and } from "drizzle-orm";

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
        { status: 400 }
      );
    }

    // Create repo records (skip duplicates)
    const repoIds: string[] = [];
    const addedRepos: string[] = [];
    const skippedRepos: string[] = [];

    for (const repoData of reposToAdd) {
      // Check if repo already exists for this user
      const existingRepo = await db.query.repos.findFirst({
        where: and(
          eq(repos.userId, session.user.id),
          eq(repos.githubRepoId, String(repoData.id))
        ),
      });

      if (existingRepo) {
        // Repo already exists, skip
        skippedRepos.push(repoData.full_name);
        continue;
      }

      const repoId = crypto.randomUUID();
      repoIds.push(repoId);
      addedRepos.push(repoData.full_name);

      await db.insert(repos).values({
        id: repoId,
        userId: session.user.id,
        githubRepoId: String(repoData.id),
        name: repoData.name,
        fullName: repoData.full_name,
        defaultBranch: repoData.default_branch,
        cloneUrl: repoData.clone_url,
        isPrivate: repoData.private,
      });
    }

    return NextResponse.json({
      repoIds,
      addedRepos,
      skippedRepos,
      success: true,
    });
  } catch (error) {
    console.error("Error adding repositories:", error);
    return NextResponse.json(
      { error: "Failed to add repositories" },
      { status: 500 }
    );
  }
}
