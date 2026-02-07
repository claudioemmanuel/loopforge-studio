/**
 * ApproveDiff Use Case
 * Orchestrates the complex workflow of approving pending changes:
 * - Creates files, commits, pushes to GitHub
 * - Optionally creates PR
 * - Marks execution completed
 * - Updates task to done status
 */

import type { ExecutionService } from "../../application/execution-service";
import type { TaskService } from "../../../task/application/task-service";
import { Result } from "@/lib/shared/Result";
import { UseCaseError } from "@/lib/shared/errors";
import {
  commitAndPush,
  createFilesFromChanges,
  buildAuthenticatedUrl,
} from "@/lib/ralph/git-operations";
import { createPullRequest } from "@/lib/github/client";
import { buildPrContent, generateBranchName } from "@/lib/github/pr-builder";
import path from "path";

const REPOS_DIR = process.env.REPOS_DIR || "/app/repos";

export interface ApproveDiffInput {
  taskId: string;
  userId: string;
  createPr: boolean;
  githubToken: string;
  task: {
    status: string;
    branch: string | null;
    title: string;
    repo: {
      id: string;
      fullName: string;
      localPath: string | null;
      cloneUrl: string;
      defaultBranch: string;
      prTargetBranch: string | null;
    };
    repoId: string;
    statusHistory?: Array<{
      from: string;
      to: string;
      timestamp: string;
      triggeredBy: string;
      userId: string;
    }>;
  };
}

export interface ApproveDiffOutput {
  success: boolean;
  task: unknown;
  commit: {
    sha: string;
    message: string;
    filesChanged: string[];
  };
  pr: {
    url: string;
    number: number;
  } | null;
}

export class ApproveDiffUseCase {
  constructor(
    private readonly executionService: ExecutionService,
    private readonly taskService: TaskService,
  ) {}

  async execute(
    input: ApproveDiffInput,
  ): Promise<Result<ApproveDiffOutput, UseCaseError>> {
    try {
      // 1. Validate task is in review status
      if (input.task.status !== "review") {
        return Result.fail(
          new UseCaseError(
            `Cannot approve changes: task status is ${input.task.status}`,
          ),
        );
      }

      // 2. Get pending changes
      const pendingChanges = await this.executionService.getPendingChanges(
        input.taskId,
      );

      if (pendingChanges.length === 0) {
        return Result.fail(new UseCaseError("No pending changes to approve"));
      }

      // 3. Get latest execution
      const latestExecution = await this.executionService.getLatestForTask(
        input.taskId,
      );

      if (!latestExecution) {
        return Result.fail(new UseCaseError("No execution found for task"));
      }

      // 4. Prepare git operations
      const branch = input.task.branch || generateBranchName(input.task);
      const repoPath =
        input.task.repo.localPath ||
        path.join(REPOS_DIR, input.task.repo.fullName.replace("/", "_"));

      // 5. Create files from pending changes
      const filesChanged = await createFilesFromChanges(
        repoPath,
        pendingChanges,
      );

      // 6. Commit and push
      const commitMessage = `[LoopForge] ${input.task.title}`;
      const remoteUrl = buildAuthenticatedUrl(
        input.task.repo.cloneUrl,
        input.githubToken,
      );
      const commitResult = await commitAndPush({
        repoPath,
        branch,
        message: commitMessage,
        files: filesChanged,
        remoteUrl,
      });

      // 7. Record the commit
      await this.executionService.recordCommit({
        executionId: latestExecution.id,
        commitSha: commitResult.sha,
        commitMessage,
        filesChanged,
      });

      // 8. Mark execution as completed with commit info
      await this.executionService.markCompleted({
        executionId: latestExecution.id,
        commits: [...(latestExecution.commits || []), commitResult.sha],
      });

      // 9. Create PR if requested
      let prUrl: string | null = null;
      let prNumber: number | null = null;

      if (input.createPr) {
        const testRun = await this.executionService.getTestRunForExecution(
          latestExecution.id,
        );

        const prContent = buildPrContent({
          task: input.task,
          repo: input.task.repo,
          execution: latestExecution,
          testRun,
          filesChanged,
          commitMessages: [commitMessage],
        });

        const pr = await createPullRequest(input.githubToken, {
          owner: input.task.repo.fullName.split("/")[0],
          repo: input.task.repo.fullName.split("/")[1],
          title: prContent.title,
          body: prContent.body,
          head: branch,
          base: input.task.repo.prTargetBranch || input.task.repo.defaultBranch,
          draft: prContent.draft,
        });

        prUrl = pr.html_url;
        prNumber = pr.number;

        // Update execution with PR info
        await this.executionService.markCompleted({
          executionId: latestExecution.id,
          prUrl,
          prNumber,
        });
      }

      // 10. Update task status to done
      const historyEntry = {
        from: input.task.status,
        to: "done",
        timestamp: new Date().toISOString(),
        triggeredBy: "user",
        userId: input.userId,
      };

      await this.taskService.updateFields(input.taskId, {
        status: "done",
        prUrl,
        prNumber,
        statusHistory: [...(input.task.statusHistory || []), historyEntry],
      });

      // 11. Clean up pending changes
      await this.executionService.deletePendingChanges(input.taskId);

      // 12. Get updated task
      const updatedTask = await this.taskService.getTaskFull(input.taskId);

      return Result.ok({
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
      return Result.fail(
        new UseCaseError("Failed to approve changes", error as Error),
      );
    }
  }
}
