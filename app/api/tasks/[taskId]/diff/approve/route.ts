/**
 * POST /api/tasks/[taskId]/diff/approve
 * Approve pending changes, commit them, and optionally create a PR
 */

import { NextResponse } from "next/server";
import { auth, getUserGithubToken } from "@/lib/auth";
import { db, tasks, executions } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  getPendingChangesByTask,
  deletePendingChangesByTask,
} from "@/lib/db/pending-changes";
import { createExecutionCommit } from "@/lib/db/execution-commits";
import { getLatestTestRun } from "@/lib/db/test-runs";
import { buildPrContent, generateBranchName } from "@/lib/github/pr-builder";
import {
  commitAndPush,
  createFilesFromChanges,
  buildAuthenticatedUrl,
} from "@/lib/ralph/git-operations";
import { createPullRequest } from "@/lib/github/client";
import type { StatusHistoryEntry } from "@/lib/db/schema";
import path from "path";

const REPOS_DIR = process.env.REPOS_DIR || "/app/repos";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const session = await auth();
  const { taskId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get task with repo to verify ownership
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: {
      repo: { with: { user: true } },
      executions: { limit: 1, orderBy: (e, { desc }) => [desc(e.createdAt)] },
    },
  });

  if (!task || task.repo.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Task must be in review status
  if (task.status !== "review") {
    return NextResponse.json(
      { error: `Cannot approve changes: task status is ${task.status}` },
      { status: 400 },
    );
  }

  // Get pending changes
  const pendingChanges = await getPendingChangesByTask(taskId);

  if (pendingChanges.length === 0) {
    return NextResponse.json(
      { error: "No pending changes to approve" },
      { status: 400 },
    );
  }

  const latestExecution = task.executions?.[0];
  if (!latestExecution) {
    return NextResponse.json(
      { error: "No execution found for task" },
      { status: 400 },
    );
  }

  // Parse request body for options
  const body = await request.json().catch(() => ({}));
  const createPr = body.createPr !== false; // Default to true

  try {
    // Get branch name
    const branch = task.branch || generateBranchName(task);

    // Compute repo path (same as worker)
    const repoPath =
      task.repo.localPath ||
      path.join(REPOS_DIR, task.repo.fullName.replace("/", "_"));

    // Get GitHub token for authenticated push
    const githubToken = await getUserGithubToken(session.user.id);
    if (!githubToken) {
      return NextResponse.json(
        {
          error:
            "GitHub token not found. Please reconnect your GitHub account.",
        },
        { status: 400 },
      );
    }

    // Create files from pending changes
    const filesChanged = await createFilesFromChanges(repoPath, pendingChanges);

    // Commit and push (with authenticated URL for push)
    const commitMessage = `[LoopForge] ${task.title}`;
    const remoteUrl = buildAuthenticatedUrl(task.repo.cloneUrl, githubToken);
    const commitResult = await commitAndPush({
      repoPath,
      branch,
      message: commitMessage,
      files: filesChanged,
      remoteUrl,
    });

    // Record the commit
    await createExecutionCommit({
      executionId: latestExecution.id,
      commitSha: commitResult.sha,
      commitMessage,
      filesChanged,
    });

    // Update execution with commit info
    await db
      .update(executions)
      .set({
        commits: [...(latestExecution.commits || []), commitResult.sha],
        completedAt: new Date(),
        status: "completed",
      })
      .where(eq(executions.id, latestExecution.id));

    // Create PR if requested
    let prUrl: string | null = null;
    let prNumber: number | null = null;

    if (createPr) {
      // Get test run for PR description
      const testRun = await getLatestTestRun(taskId);

      // Build PR content
      const prContent = buildPrContent({
        task,
        repo: task.repo,
        execution: latestExecution,
        testRun,
        filesChanged,
        commitMessages: [commitMessage],
      });

      // Create the PR (githubToken already retrieved above)
      const pr = await createPullRequest(githubToken, {
        owner: task.repo.fullName.split("/")[0],
        repo: task.repo.fullName.split("/")[1],
        title: prContent.title,
        body: prContent.body,
        head: branch,
        base: task.repo.prTargetBranch || task.repo.defaultBranch,
        draft: prContent.draft,
      });

      prUrl = pr.html_url;
      prNumber = pr.number;

      // Update execution with PR info
      await db
        .update(executions)
        .set({ prUrl, prNumber })
        .where(eq(executions.id, latestExecution.id));
    }

    // Update task status to done
    const historyEntry: StatusHistoryEntry = {
      from: task.status,
      to: "done",
      timestamp: new Date().toISOString(),
      triggeredBy: "user",
      userId: session.user.id,
    };

    await db
      .update(tasks)
      .set({
        status: "done",
        prUrl,
        prNumber,
        statusHistory: [...(task.statusHistory || []), historyEntry],
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    // Clean up pending changes
    await deletePendingChangesByTask(taskId);

    // Fetch updated task
    const updatedTask = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    });

    return NextResponse.json({
      success: true,
      task: updatedTask,
      commit: {
        sha: commitResult.sha,
        message: commitMessage,
        filesChanged,
      },
      pr: prUrl ? { url: prUrl, number: prNumber } : null,
    });
  } catch (error) {
    console.error("Error approving changes:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to approve changes",
      },
      { status: 500 },
    );
  }
}
