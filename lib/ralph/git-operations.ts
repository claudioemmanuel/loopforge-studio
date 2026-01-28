/**
 * Git Operations - Commit and push changes using simple-git
 */

import simpleGit, { type SimpleGit } from "simple-git";

export interface CommitResult {
  sha: string;
  message: string;
  filesChanged: number;
}

export interface PushResult {
  success: boolean;
  error?: string;
}

/**
 * Stage and commit changes in a repository
 *
 * @param repoPath - Path to the git repository
 * @param message - Commit message
 * @param files - Optional list of specific files to stage (stages all if not provided)
 */
export async function commitChanges(
  repoPath: string,
  message: string,
  files?: string[],
): Promise<CommitResult> {
  const git: SimpleGit = simpleGit(repoPath);

  // Stage files
  if (files && files.length > 0) {
    await git.add(files);
  } else {
    await git.add(".");
  }

  // Check if there are changes to commit
  const status = await git.status();
  if (status.staged.length === 0) {
    throw new Error("No changes to commit");
  }

  // Commit
  const commitResult = await git.commit(message);

  return {
    sha: commitResult.commit || "",
    message,
    filesChanged: status.staged.length,
  };
}

/**
 * Push a branch to the remote repository
 *
 * @param repoPath - Path to the git repository
 * @param branch - Branch name to push
 * @param remoteUrl - Optional authenticated remote URL (if not using existing remote config)
 */
export async function pushBranch(
  repoPath: string,
  branch: string,
  remoteUrl?: string,
): Promise<PushResult> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    // If a remote URL is provided, update the origin URL temporarily for authenticated push
    if (remoteUrl) {
      const remotes = await git.getRemotes(true);
      const originRemote = remotes.find((r) => r.name === "origin");
      const originalUrl = originRemote?.refs.push || originRemote?.refs.fetch;

      // Set the authenticated URL
      await git.remote(["set-url", "origin", remoteUrl]);

      try {
        // Push with upstream tracking
        await git.push(["--set-upstream", "origin", branch]);
      } finally {
        // Restore original URL if we had one
        if (originalUrl) {
          await git.remote(["set-url", "origin", originalUrl]);
        }
      }
    } else {
      // Push using existing remote config
      await git.push("origin", branch);
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Unknown error pushing branch",
    };
  }
}

/**
 * Get the current branch name
 */
export async function getCurrentBranch(repoPath: string): Promise<string> {
  const git: SimpleGit = simpleGit(repoPath);
  const branchInfo = await git.branch();
  return branchInfo.current;
}

/**
 * Check if there are uncommitted changes
 */
export async function hasUncommittedChanges(
  repoPath: string,
): Promise<boolean> {
  const git: SimpleGit = simpleGit(repoPath);
  const status = await git.status();
  return (
    status.modified.length > 0 ||
    status.created.length > 0 ||
    status.deleted.length > 0 ||
    status.not_added.length > 0
  );
}

/**
 * Get list of commits between current HEAD and a base branch
 */
export async function getCommitsSinceBase(
  repoPath: string,
  baseBranch: string,
): Promise<Array<{ sha: string; message: string }>> {
  const git: SimpleGit = simpleGit(repoPath);

  try {
    const log = await git.log({
      from: `origin/${baseBranch}`,
      to: "HEAD",
    });

    return log.all.map((commit) => ({
      sha: commit.hash,
      message: commit.message,
    }));
  } catch {
    // If base branch doesn't exist on remote, return empty
    return [];
  }
}

/**
 * Build an authenticated clone URL from a regular clone URL and token
 */
export function buildAuthenticatedUrl(cloneUrl: string, token: string): string {
  const url = new URL(cloneUrl);
  url.username = "x-access-token";
  url.password = token;
  return url.toString();
}

/**
 * Commit changes and push to remote in one operation
 */
export async function commitAndPush(options: {
  repoPath: string;
  branch: string;
  message: string;
  files?: string[];
  remoteUrl?: string;
}): Promise<CommitResult & { pushed: boolean }> {
  const { repoPath, branch, message, files, remoteUrl } = options;
  const git: SimpleGit = simpleGit(repoPath);

  // Ensure we're on the correct branch
  const currentBranch = await getCurrentBranch(repoPath);
  if (currentBranch !== branch) {
    await git.checkout(branch);
  }

  // Commit changes
  const commitResult = await commitChanges(repoPath, message, files);

  // Push to remote
  const pushResult = await pushBranch(repoPath, branch, remoteUrl);

  return {
    ...commitResult,
    pushed: pushResult.success,
  };
}

/**
 * Create files from pending changes
 */
export async function createFilesFromChanges(
  repoPath: string,
  changes: Array<{
    filePath: string;
    action: "create" | "modify" | "delete";
    newContent: string;
  }>,
): Promise<string[]> {
  const fs = await import("fs/promises");
  const path = await import("path");
  const filesChanged: string[] = [];

  for (const change of changes) {
    const fullPath = path.join(repoPath, change.filePath);

    if (change.action === "delete") {
      try {
        await fs.unlink(fullPath);
        filesChanged.push(change.filePath);
      } catch {
        // File may not exist, ignore
      }
    } else {
      // Ensure directory exists
      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });

      // Write the file
      await fs.writeFile(fullPath, change.newContent, "utf-8");
      filesChanged.push(change.filePath);
    }
  }

  return filesChanged;
}

/**
 * Discard uncommitted changes on a branch
 */
export async function discardBranchChanges(options: {
  repoPath: string;
  branch: string;
}): Promise<void> {
  const { repoPath, branch } = options;
  const git: SimpleGit = simpleGit(repoPath);

  // Ensure we're on the correct branch
  const currentBranch = await getCurrentBranch(repoPath);
  if (currentBranch !== branch) {
    await git.checkout(branch);
  }

  // Discard all changes
  await git.reset(["--hard", "HEAD"]);
  await git.clean("f", ["-d"]); // Remove untracked files and directories
}

/**
 * Revert commits using git revert (safe, preserves history)
 */
export async function revertCommits(options: {
  repoPath: string;
  branch: string;
  commitShas: string[];
  message?: string;
}): Promise<{ revertSha: string; message: string }> {
  const { repoPath, branch, commitShas, message } = options;
  const git: SimpleGit = simpleGit(repoPath);

  // Ensure we're on the correct branch
  const currentBranch = await getCurrentBranch(repoPath);
  if (currentBranch !== branch) {
    await git.checkout(branch);
  }

  // Pull latest to avoid conflicts
  try {
    await git.pull("origin", branch);
  } catch {
    // Ignore pull errors (branch may not exist on remote yet)
  }

  // Revert commits in reverse order (newest first)
  // Use --no-commit to batch all reverts into one commit
  for (const sha of commitShas) {
    await git.revert(sha, ["--no-commit"]);
  }

  // Create the revert commit
  const revertMessage =
    message ||
    `Revert ${commitShas.length} commit(s): ${commitShas.join(", ")}`;
  const commitResult = await git.commit(revertMessage);

  // Push the revert
  await pushBranch(repoPath, branch);

  return {
    revertSha: commitResult.commit || "",
    message: revertMessage,
  };
}

/**
 * Check if newer commits exist on the branch that weren't made by LoopForge
 */
export async function hasNewerNonLoopforgeCommits(options: {
  repoPath: string;
  branch: string;
  lastLoopforgeSha: string;
}): Promise<boolean> {
  const { repoPath, branch, lastLoopforgeSha } = options;
  const git: SimpleGit = simpleGit(repoPath);

  // Get commits after the last LoopForge commit
  const log = await git.log({
    from: lastLoopforgeSha,
    to: branch,
  });

  // Check if any commits exist that don't contain [LoopForge] in the message
  return log.all.some(
    (commit) =>
      !commit.message.includes("[LoopForge]") &&
      commit.hash !== lastLoopforgeSha,
  );
}

/**
 * Get the current HEAD SHA
 */
export async function getHeadSha(repoPath: string): Promise<string> {
  const git: SimpleGit = simpleGit(repoPath);
  const result = await git.revparse(["HEAD"]);
  return result.trim();
}
