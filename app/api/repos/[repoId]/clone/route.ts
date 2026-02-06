import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { decryptGithubToken } from "@/lib/crypto";
import { queueIndexing } from "@/lib/queue";
import simpleGit from "simple-git";
import path from "path";
import fs from "fs/promises";
import { handleError, Errors } from "@/lib/errors";
import { expandPath, getDefaultCloneDirectory } from "@/lib/utils/path-utils";
import { emitCloneStatusChange } from "@/lib/contexts/repository/infrastructure/clone-status";
import { getRepositoryService } from "@/lib/contexts/repository/api";
import { getUserService } from "@/lib/contexts/iam/api";

/**
 * Get clone directory for user with fallback priority
 */
function getCloneDirectory(userDefaultCloneDirectory?: string | null): string {
  // Priority 1: User's configured directory
  if (userDefaultCloneDirectory) {
    return expandPath(userDefaultCloneDirectory);
  }

  // Priority 2: Environment variable (Docker compatibility)
  if (process.env.REPOS_DIR) {
    return process.env.REPOS_DIR;
  }

  // Priority 3: OS-specific default
  return getDefaultCloneDirectory();
}

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

  const repositoryService = getRepositoryService();
  const userService = getUserService();

  // Get repo
  const repo = await repositoryService.findByOwner(repoId, session.user.id);

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

  // Get user's GitHub token
  const user = await userService.getUserFull(session.user.id);

  // Check if clone directory is configured
  if (!user?.defaultCloneDirectory && !process.env.REPOS_DIR) {
    return NextResponse.json(
      {
        error: "Clone directory not configured",
        requiresConfiguration: true,
        message: "Please configure a clone directory in Settings",
      },
      { status: 400 },
    );
  }

  // Determine target path
  const sanitizedName = repo.fullName.replace("/", "_");
  const baseDir = getCloneDirectory(user?.defaultCloneDirectory);
  const targetPath = customPath || path.join(baseDir, sanitizedName);

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
    // Update status to "cloning" before starting
    await repositoryService.markCloneStarted(repoId);

    // Emit cloning started event
    emitCloneStatusChange({
      repoId,
      status: "cloning",
      timestamp: new Date(),
    });

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
    await repositoryService.markCloneCompleted(repoId, targetPath);

    // Emit completion event
    emitCloneStatusChange({
      repoId,
      status: "completed",
      timestamp: new Date(),
    });

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
    // Update status to "failed" on error
    await repositoryService.markCloneFailed(repoId);

    // Emit failure event
    emitCloneStatusChange({
      repoId,
      status: "failed",
      timestamp: new Date(),
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return handleError(error);
  }
}
