/**
 * POST /api/tasks/[taskId]/diff/approve
 * Approve pending changes, commit them, and optionally create a PR
 */

import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getUserGithubToken } from "@/lib/auth";
import { withTask } from "@/lib/api";
import { handleError } from "@/lib/errors";
import { getApproveDiffUseCase } from "@/lib/contexts/execution/api";

export const POST = withTask(async (request, { user, task, taskId }) => {
  // Parse request body for options
  const body = await request.json().catch(() => ({}));
  const createPr = body.createPr !== false; // Default to true

  // Get GitHub token for authenticated push
  const githubToken = await getUserGithubToken(user.id);
  if (!githubToken) {
    return NextResponse.json(
      {
        error: "GitHub token not found. Please reconnect your GitHub account.",
      },
      { status: 400 },
    );
  }

  // Execute use case
  const approveDiffUseCase = getApproveDiffUseCase();
  const result = await approveDiffUseCase.execute({
    taskId,
    userId: user.id,
    createPr,
    githubToken,
    task: {
      status: task.status,
      branch: task.branch,
      title: task.title,
      repo: {
        id: task.repo.id,
        fullName: task.repo.fullName,
        localPath: task.repo.localPath,
        cloneUrl: task.repo.cloneUrl,
        defaultBranch: task.repo.defaultBranch,
        prTargetBranch: task.repo.prTargetBranch,
      },
      repoId: task.repoId,
      statusHistory: task.statusHistory,
    },
  });

  if (result.isFailure) {
    return handleError(result.error);
  }

  const output = result.value;

  // Invalidate caches after approving diff
  revalidateTag(`task:${taskId}`);
  revalidateTag("tasks");
  revalidateTag(`repo:${task.repoId}`);

  return NextResponse.json(output);
});
