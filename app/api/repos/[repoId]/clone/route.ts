import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, repos, users } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { decryptGithubToken } from "@/lib/crypto";
import { queueIndexing } from "@/lib/queue";
import simpleGit from "simple-git";
import path from "path";
import fs from "fs/promises";
import { handleError, Errors } from "@/lib/errors";

const REPOS_DIR = process.env.REPOS_DIR || "/app/repos";

/**
 * POST /api/repos/[repoId]/clone
 * Initiates cloning a repository to a local path
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ repoId: string }> },
) {
  const session = await auth();
  const { repoId } = await params;

  if (!session?.user?.id) {
    return handleError(Errors.unauthorized());
  }

  // Get repo
  const repo = await db.query.repos.findFirst({
    where: and(eq(repos.id, repoId), eq(repos.userId, session.user.id)),
  });

  if (!repo) {
    return handleError(Errors.notFound("Repository"));
  }

  // Check if already cloned
  if (repo.isCloned && repo.localPath) {
    try {
      await fs.access(repo.localPath);
      return NextResponse.json({
        success: true,
        message: "Repository already cloned",
        localPath: repo.localPath,
        alreadyCloned: true,
      });
    } catch {
      // Path no longer exists, need to re-clone
    }
  }

  // Get optional custom path from request body
  let customPath: string | undefined;
  try {
    const body = await request.json();
    customPath = body.localPath;
  } catch {
    // No body provided, use default path
  }

  // Determine target path
  const sanitizedName = repo.fullName.replace("/", "_");
  const targetPath = customPath || path.join(REPOS_DIR, sanitizedName);

  // Get user's GitHub token
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user?.encryptedGithubToken || !user?.githubTokenIv) {
    return handleError(Errors.invalidRequest("GitHub token not configured"));
  }

  let githubToken: string;
  try {
    githubToken = decryptGithubToken({
      encrypted: user.encryptedGithubToken,
      iv: user.githubTokenIv,
    });
  } catch {
    return handleError(Errors.serverError());
  }

  // Build authenticated clone URL
  const cloneUrl = new URL(repo.cloneUrl);
  cloneUrl.username = "x-access-token";
  cloneUrl.password = githubToken;

  try {
    // Ensure parent directory exists
    await fs.mkdir(path.dirname(targetPath), { recursive: true });

    // Check if directory exists
    let dirExists = false;
    try {
      await fs.access(targetPath);
      dirExists = true;
    } catch {
      dirExists = false;
    }

    const git = simpleGit();

    if (dirExists) {
      // Directory exists, check if it's a git repo and update
      const repoGit = simpleGit(targetPath);
      const isRepo = await repoGit.checkIsRepo();

      if (isRepo) {
        // Fetch latest
        await repoGit.fetch("origin");
        await repoGit.checkout(repo.defaultBranch);
        await repoGit.pull("origin", repo.defaultBranch);
      } else {
        // Not a git repo, remove and clone fresh
        await fs.rm(targetPath, { recursive: true, force: true });
        await git.clone(cloneUrl.toString(), targetPath, [
          "--branch",
          repo.defaultBranch,
        ]);
      }
    } else {
      // Clone fresh
      await git.clone(cloneUrl.toString(), targetPath, [
        "--branch",
        repo.defaultBranch,
      ]);
    }

    // Update repo record
    await db
      .update(repos)
      .set({
        localPath: targetPath,
        isCloned: true,
        clonedAt: new Date(),
        indexingStatus: "pending", // Ready for indexing
        updatedAt: new Date(),
      })
      .where(eq(repos.id, repoId));

    // Queue indexing job
    let indexingJobId: string | undefined;
    try {
      const indexJob = await queueIndexing({
        repoId,
        userId: session.user.id,
        localPath: targetPath,
        repoName: repo.name,
      });
      indexingJobId = indexJob.id;
    } catch (indexError) {
      console.error("Failed to queue indexing:", indexError);
      // Clone succeeded, indexing queue failed - not critical
    }

    return NextResponse.json({
      success: true,
      localPath: targetPath,
      message: "Repository cloned successfully",
      indexingJobId,
    });
  } catch (error) {
    return handleError(error);
  }
}
