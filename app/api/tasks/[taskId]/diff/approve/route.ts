/**
 * POST /api/tasks/[taskId]/diff/approve
 * Approve pending changes, commit them, and optionally create a PR
 */

import { NextResponse } from "next/server";
import { getUserGithubToken } from "@/lib/auth";
import { buildPrContent, generateBranchName } from "@/lib/github/pr-builder";
import {
  commitAndPush,
  createFilesFromChanges,
  buildAuthenticatedUrl,
} from "@/lib/ralph/git-operations";
import { createPullRequest } from "@/lib/github/client";
import type { StatusHistoryEntry } from "@/lib/db/schema";
import { withTask } from "@/lib/api";
import { getTaskService } from "@/lib/contexts/task/api";
import { getExecutionService } from "@/lib/contexts/execution/api";
import path from "path";

const REPOS_DIR = process.env.REPOS_DIR || "/app/repos";

export const POST = withTask(async (request, { user, task, taskId }) => {
  // Task must be in review status
  if (task.status !== "review") {
    return NextResponse.json(
      { error: `Cannot approve changes: task status is ${task.status}` },
      { status: 400 },
    );
  }

  const executionService = getExecutionService();

  // Get pending changes
  const pendingChanges = await executionService.getPendingChanges(taskId);

  if (pendingChanges.length === 0) {
    return NextResponse.json(
      { error: "No pending changes to approve" },
      { status: 400 },
    );
  }

  const latestExecution = await executionService.getLatestForTask(taskId);

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
    const githubToken = await getUserGithubToken(user.id);
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
    await executionService.recordCommit({
      executionId: latestExecution.id,
      commitSha: commitResult.sha,
      commitMessage,
      filesChanged,
    });

    // Mark execution as completed with commit info
    await executionService.markCompleted({
      executionId: latestExecution.id,
      commits: [...(latestExecution.commits || []), commitResult.sha],
    });

    // Create PR if requested
    let prUrl: string | null = null;
    let prNumber: number | null = null;

    if (createPr) {
      // Get test run for PR description
      const testRun = await executionService.getTestRunForExecution(
        latestExecution.id,
      );

      // Build PR content
      const prContent = buildPrContent({
        task,
        repo: task.repo,
        execution: latestExecution,
        testRun,
        filesChanged,
        commitMessages: [commitMessage],
      });

      // Create the PR
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
      await executionService.markCompleted({
        executionId: latestExecution.id,
        prUrl,
        prNumber,
      });
    }

    // Update task status to done
    const taskService = getTaskService();
    const historyEntry: StatusHistoryEntry = {
      from: task.status,
      to: "done",
      timestamp: new Date().toISOString(),
      triggeredBy: "user",
      userId: user.id,
    };

    await taskService.updateFields(taskId, {
      status: "done",
      prUrl,
      prNumber,
      statusHistory: [...(task.statusHistory || []), historyEntry],
    });

    // Clean up pending changes
    await executionService.deletePendingChanges(taskId);

    const updatedTask = await taskService.getTaskFull(taskId);

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
});
