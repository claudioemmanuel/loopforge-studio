import type { ExecutionSummary, RepoSummary, TaskStatus, TaskSummary, UserAccount } from "./domain";

export interface TaskRepository {
  getTaskWithRepo(taskId: string): Promise<TaskSummary | null>;
  setBrainstormResult(taskId: string, result: string): Promise<boolean>;
  setPlanResult(taskId: string, plan: string, branch: string): Promise<boolean>;
  updateStatusIf(
    taskId: string,
    fromStatus: TaskStatus,
    toStatus: TaskStatus,
  ): Promise<boolean>;
  updateStatus(taskId: string, status: TaskStatus): Promise<void>;
}

export interface ExecutionRepository {
  createExecution(taskId: string): Promise<ExecutionSummary>;
  deleteExecution(executionId: string): Promise<void>;
}

export interface RepoRepository {
  getRepoById(repoId: string): Promise<RepoSummary | null>;
}

export interface UserRepository {
  getUserById(userId: string): Promise<UserAccount | null>;
}
