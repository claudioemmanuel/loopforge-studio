import type { RepoContext } from "@/lib/ai";
import type { AIGateway } from "../ports/ai-gateway";
import type { AISettingsGateway } from "../ports/ai-settings-gateway";
import type { CryptoGateway } from "../ports/crypto-gateway";
import type { GitHubGateway } from "../ports/github-gateway";
import type { AppLogger } from "../ports/logger";
import type { ProgressReporter } from "../ports/progress-reporter";
import type { QueueGateway } from "../ports/queue-gateway";
import type { RepoRepository, TaskRepository, ExecutionRepository, UserRepository } from "../ports/repositories";
import type { WorkerEventsGateway } from "../ports/worker-events-gateway";

export interface AutonomousFlowJobData {
  taskId: string;
  userId: string;
  repoId: string;
}

export interface AutonomousFlowJobResult {
  success: boolean;
  finalStatus: "executing" | "stuck";
  error?: string;
}

const EMPTY_REPO_CONTEXT: RepoContext = {
  techStack: [],
  fileStructure: [],
  configFiles: [],
};

export interface AutonomousFlowDependencies {
  taskRepository: TaskRepository;
  executionRepository: ExecutionRepository;
  repoRepository: RepoRepository;
  userRepository: UserRepository;
  aiGateway: AIGateway;
  aiSettingsGateway: AISettingsGateway;
  githubGateway: GitHubGateway;
  queueGateway: QueueGateway;
  workerEventsGateway: WorkerEventsGateway;
  cryptoGateway: CryptoGateway;
  logger: AppLogger;
}

export class AutonomousFlowService {
  constructor(private readonly deps: AutonomousFlowDependencies) {}

  async run(
    data: AutonomousFlowJobData,
    progressReporter: ProgressReporter,
  ): Promise<AutonomousFlowJobResult> {
    const { taskId, userId, repoId } = data;

    this.deps.logger.info({ taskId }, "Starting autonomous flow");

    try {
      const user = await this.deps.userRepository.getUserById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      const aiConfig = this.deps.aiSettingsGateway.getClientConfig(user);
      if (!aiConfig) {
        throw new Error("No AI provider configured");
      }

      const client = await this.deps.aiGateway.createClient(
        aiConfig.provider,
        aiConfig.apiKey,
        aiConfig.model,
      );

      const task = await this.deps.taskRepository.getTaskWithRepo(taskId);
      if (!task) {
        throw new Error("Task not found");
      }

      // Step 1: Brainstorm
      this.deps.logger.info({ taskId, step: 1 }, "Generating brainstorm");
      await progressReporter.updateProgress({ step: "brainstorming", progress: 10 });

      await this.deps.workerEventsGateway.publishTaskUpdate({
        userId,
        taskId,
        taskTitle: task.title,
        repoName: task.repo.name,
        status: "brainstorming",
        payload: { currentAction: "Generating ideas..." },
      });

      let repoContext: RepoContext = EMPTY_REPO_CONTEXT;
      if (user.encryptedGithubToken && user.githubTokenIv) {
        try {
          const githubToken = this.deps.cryptoGateway.decryptGithubToken({
            encrypted: user.encryptedGithubToken,
            iv: user.githubTokenIv,
          });
          const [owner, repoName] = task.repo.fullName.split("/");
          this.deps.logger.info({ repo: task.repo.fullName }, "Scanning repo");
          repoContext = await this.deps.githubGateway.scanRepo(
            githubToken,
            owner,
            repoName,
            task.repo.defaultBranch || "main",
          );
          this.deps.logger.info(
            { techStack: repoContext.techStack },
            "Tech stack detected",
          );
        } catch (error) {
          this.deps.logger.error({ error }, "GitHub scan failed");
          repoContext = EMPTY_REPO_CONTEXT;
        }
      } else {
        this.deps.logger.info("No GitHub token, using empty context");
      }

      const brainstormResult = await this.deps.aiGateway.generateInitialBrainstorm(
        client,
        task.title,
        task.description,
        repoContext,
      );

      const brainstormUpdated = await this.deps.taskRepository.setBrainstormResult(
        taskId,
        JSON.stringify(brainstormResult),
      );

      if (!brainstormUpdated) {
        throw new Error(
          "Task state changed during autonomous flow - brainstorm update aborted",
        );
      }

      await progressReporter.updateProgress({ step: "brainstorming", progress: 33 });
      this.deps.logger.info({ taskId }, "Brainstorm complete");

      // Step 2: Plan
      this.deps.logger.info({ taskId, step: 2 }, "Generating plan");
      await progressReporter.updateProgress({ step: "planning", progress: 40 });

      await this.deps.workerEventsGateway.publishTaskUpdate({
        userId,
        taskId,
        taskTitle: task.title,
        repoName: task.repo.name,
        status: "planning",
        payload: { currentAction: "Creating execution plan..." },
      });

      const planResult = await this.deps.aiGateway.generatePlan(
        client,
        task.title,
        task.description,
        JSON.stringify(brainstormResult),
        {
          name: task.repo.name,
          fullName: task.repo.fullName,
          defaultBranch: task.repo.defaultBranch || "main",
          techStack: repoContext.techStack,
        },
      );

      const branchName = `loopforge/${taskId.slice(0, 8)}`;
      const planUpdated = await this.deps.taskRepository.setPlanResult(
        taskId,
        JSON.stringify(planResult),
        branchName,
      );

      if (!planUpdated) {
        throw new Error(
          "Task state changed during autonomous flow - plan update aborted",
        );
      }

      await progressReporter.updateProgress({ step: "planning", progress: 66 });
      this.deps.logger.info({ taskId }, "Plan complete");

      // Step 3: Ready + execution
      this.deps.logger.info(
        { taskId, step: 3 },
        "Marking ready and queueing execution",
      );
      await progressReporter.updateProgress({ step: "ready", progress: 70 });

      await this.deps.workerEventsGateway.publishTaskUpdate({
        userId,
        taskId,
        taskTitle: task.title,
        repoName: task.repo.name,
        status: "ready",
        payload: { currentAction: "Ready for execution" },
      });

      const readyUpdated = await this.deps.taskRepository.updateStatusIf(
        taskId,
        "planning",
        "ready",
      );

      if (!readyUpdated) {
        throw new Error(
          "Task state changed during autonomous flow - ready update aborted",
        );
      }

      const repo = await this.deps.repoRepository.getRepoById(repoId);
      if (!repo) {
        throw new Error("Repository not found");
      }

      const execution = await this.deps.executionRepository.createExecution(taskId);

      const executingUpdated = await this.deps.taskRepository.updateStatusIf(
        taskId,
        "ready",
        "executing",
      );

      if (!executingUpdated) {
        await this.deps.executionRepository.deleteExecution(execution.id);
        throw new Error(
          "Task state changed during autonomous flow - executing update aborted",
        );
      }

      await this.deps.workerEventsGateway.publishTaskUpdate({
        userId,
        taskId,
        taskTitle: task.title,
        repoName: task.repo.name,
        status: "executing",
        payload: {
          currentAction: "Executing plan...",
          currentStep: `Step 1/${planResult.steps?.length || 1}`,
        },
      });

      await progressReporter.updateProgress({ step: "executing", progress: 80 });

      await this.deps.queueGateway.queueExecution({
        executionId: execution.id,
        taskId,
        repoId,
        userId,
        aiProvider: aiConfig.provider,
        preferredModel: aiConfig.model,
        planContent: JSON.stringify(planResult),
        branch: branchName,
        defaultBranch: task.repo.defaultBranch || "main",
        cloneUrl: repo.cloneUrl,
      });

      await progressReporter.updateProgress({ step: "executing", progress: 100 });
      this.deps.logger.info({ taskId }, "Execution queued");

      return {
        success: true,
        finalStatus: "executing",
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.deps.logger.error({ taskId, error: errorMessage }, "Autonomous flow error");

      const failedTask = await this.deps.taskRepository.getTaskWithRepo(taskId);
      await this.deps.taskRepository.updateStatus(taskId, "stuck");

      if (failedTask) {
        await this.deps.workerEventsGateway.publishTaskUpdate({
          userId,
          taskId,
          taskTitle: failedTask.title,
          repoName: failedTask.repo.name,
          status: "stuck",
          payload: { error: errorMessage },
        });
      }

      return {
        success: false,
        finalStatus: "stuck",
        error: errorMessage,
      };
    }
  }
}
