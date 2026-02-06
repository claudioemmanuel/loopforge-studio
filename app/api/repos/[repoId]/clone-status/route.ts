import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import fs from "fs/promises";
import path from "path";
import { handleError, Errors } from "@/lib/errors";
import { getRepositoryService } from "@/lib/contexts/repository/api";

/**
 * GET /api/repos/[repoId]/clone-status
 * Returns the current clone and indexing status of a repository
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ repoId: string }> },
) {
  const session = await auth();
  const { repoId } = await params;

  if (!session?.user?.id) {
    return handleError(Errors.unauthorized());
  }

  const repositoryService = getRepositoryService();
  const repo = await repositoryService.getRepositoryWithIndexByOwner(
    repoId,
    session.user.id,
  );

  if (!repo) {
    return handleError(Errors.notFound("Repository"));
  }

  // Check if local path still exists
  let localPathExists = false;
  if (repo.localPath) {
    try {
      await fs.access(repo.localPath);
      localPathExists = true;
    } catch {
      localPathExists = false;
    }
  }

  // Get directory stats if path exists
  let stats = null;
  if (localPathExists && repo.localPath) {
    try {
      const dirStat = await fs.stat(repo.localPath);
      stats = {
        isDirectory: dirStat.isDirectory(),
        modifiedAt: dirStat.mtime.toISOString(),
      };

      // Check for .git directory
      try {
        await fs.access(path.join(repo.localPath, ".git"));
        stats = { ...stats, isGitRepo: true };
      } catch {
        stats = { ...stats, isGitRepo: false };
      }
    } catch {
      // Stats unavailable
    }
  }

  return NextResponse.json({
    repoId: repo.id,
    isCloned: repo.isCloned && localPathExists,
    localPath: repo.localPath,
    localPathExists,
    clonedAt: repo.clonedAt,
    indexingStatus: repo.indexingStatus,
    indexedAt: repo.indexedAt,
    stats,
    index: repo.index
      ? {
          fileCount: repo.index.fileCount,
          symbolCount: repo.index.symbolCount,
          techStack: repo.index.techStack,
          updatedAt: repo.index.updatedAt,
        }
      : null,
  });
}
