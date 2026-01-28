import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, repos } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";

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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repo = await db.query.repos.findFirst({
    where: and(eq(repos.id, repoId), eq(repos.userId, session.user.id)),
    with: {
      index: true,
    },
  });

  if (!repo) {
    return NextResponse.json(
      { error: "Repository not found" },
      { status: 404 },
    );
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
