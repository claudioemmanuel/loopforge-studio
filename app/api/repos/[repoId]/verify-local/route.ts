import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, repos } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";
import os from "os";

// Common development directories to check
const COMMON_DEV_PATHS = [
  "~/Projects",
  "~/Documents/GitHub",
  "~/Developer",
  "~/dev",
  "~/code",
  "~/workspace",
  "~/repos",
];

/**
 * Expand ~ to home directory
 */
function expandPath(p: string): string {
  if (p.startsWith("~/")) {
    return path.join(os.homedir(), p.slice(2));
  }
  return p;
}

/**
 * POST /api/repos/[repoId]/verify-local
 * Verifies if a local path exists and contains the repository
 * Also searches common paths for existing clones
 */
export async function POST(
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
  });

  if (!repo) {
    return NextResponse.json(
      { error: "Repository not found" },
      { status: 404 },
    );
  }

  // Get path to verify from request body
  let pathToVerify: string | undefined;
  let searchCommonPaths = false;

  try {
    const body = await request.json();
    pathToVerify = body.localPath;
    searchCommonPaths = body.searchCommonPaths ?? false;
  } catch {
    searchCommonPaths = true; // Default to searching if no body
  }

  const results: {
    verified: boolean;
    path?: string;
    isGitRepo?: boolean;
    matchesRemote?: boolean;
    suggestedPaths: string[];
  } = {
    verified: false,
    suggestedPaths: [],
  };

  // If specific path provided, verify it
  if (pathToVerify) {
    const expanded = expandPath(pathToVerify);
    try {
      await fs.access(expanded);
      const gitPath = path.join(expanded, ".git");

      try {
        await fs.access(gitPath);
        results.verified = true;
        results.path = expanded;
        results.isGitRepo = true;

        // Check if remote matches
        try {
          const configPath = path.join(gitPath, "config");
          const config = await fs.readFile(configPath, "utf-8");
          results.matchesRemote = config.includes(repo.fullName);
        } catch {
          results.matchesRemote = false;
        }
      } catch {
        // Directory exists but not a git repo
        results.verified = false;
        results.path = expanded;
        results.isGitRepo = false;
      }
    } catch {
      // Path doesn't exist
      results.verified = false;
    }
  }

  // Search common paths for existing clones
  if (searchCommonPaths) {
    const repoName = repo.name;
    const possibleNames = [
      repoName,
      repo.fullName.replace("/", "_"),
      repo.fullName.split("/")[1], // Just the repo name without owner
    ];

    for (const basePath of COMMON_DEV_PATHS) {
      const expanded = expandPath(basePath);

      for (const name of possibleNames) {
        const candidatePath = path.join(expanded, name);

        try {
          await fs.access(candidatePath);
          const gitConfigPath = path.join(candidatePath, ".git", "config");

          try {
            const config = await fs.readFile(gitConfigPath, "utf-8");
            // Check if this repo matches our target
            if (
              config.includes(repo.fullName) ||
              config.includes(repo.cloneUrl)
            ) {
              results.suggestedPaths.push(candidatePath);

              // If no verified path yet, use this one
              if (!results.verified) {
                results.verified = true;
                results.path = candidatePath;
                results.isGitRepo = true;
                results.matchesRemote = true;
              }
            }
          } catch {
            // Can't read git config, but directory exists
            results.suggestedPaths.push(candidatePath);
          }
        } catch {
          // Path doesn't exist, continue
        }
      }
    }
  }

  // If we found a valid path, update the repo record
  if (results.verified && results.path && results.matchesRemote) {
    await db
      .update(repos)
      .set({
        localPath: results.path,
        isCloned: true,
        clonedAt: new Date(),
        indexingStatus: "pending",
        updatedAt: new Date(),
      })
      .where(eq(repos.id, repoId));
  }

  return NextResponse.json(results);
}
