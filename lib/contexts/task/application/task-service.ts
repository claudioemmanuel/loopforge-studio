/**
 * Task Service (Application Layer)
 *
 * Orchestrates task operations and coordinates with infrastructure.
 * Public API for Task Orchestration bounded context.
 */

import type { Redis } from "ioredis";
import { TaskRepository } from "../infrastructure/task-repository";
import { TaskAggregate } from "../domain/task-aggregate";
import { TaskDependencyGraph } from "../domain/dependency-graph";
import type {
  TaskMetadata,
  TaskConfiguration,
  BrainstormResult,
  ExecutionResult,
  TaskStatus,
} from "../domain/types";
import { randomUUID } from "crypto";
import { TaskAdapter, type TaskApiResponse } from "../api/adapters";

/**
 * Task service
 */
export class TaskService {
  private taskRepository: TaskRepository;
  private dependencyGraph: TaskDependencyGraph;

  constructor(redis: Redis) {
    this.taskRepository = new TaskRepository(redis);
    this.dependencyGraph = TaskDependencyGraph.create(redis);
  }

  /**
   * Create a new task
   */
  async createTask(params: {
    repositoryId: string;
    metadata: TaskMetadata;
    configuration?: Partial<TaskConfiguration>;
  }): Promise<{ taskId: string }> {
    const taskId = randomUUID();

    // Create task aggregate
    const task = await TaskAggregate.create(
      {
        id: taskId,
        repositoryId: params.repositoryId,
        metadata: params.metadata,
        configuration: params.configuration,
      },
      this.taskRepository["redis"],
    );

    // Persist
    await this.taskRepository.save(task);

    return { taskId };
  }

  /**
   * Start brainstorming phase
   */
  async startBrainstorm(params: {
    taskId: string;
    jobId: string;
  }): Promise<void> {
    const task = await this.taskRepository.findById(params.taskId);
    if (!task) {
      throw new Error(`Task ${params.taskId} not found`);
    }

    await task.startBrainstorm(params.jobId);
    await this.taskRepository.save(task);
  }

  /**
   * Complete brainstorming phase
   */
  async completeBrainstorm(params: {
    taskId: string;
    result: BrainstormResult;
  }): Promise<void> {
    const task = await this.taskRepository.findById(params.taskId);
    if (!task) {
      throw new Error(`Task ${params.taskId} not found`);
    }

    await task.completeBrainstorm(params.result);
    await this.taskRepository.save(task);
  }

  /**
   * Start planning phase
   */
  async startPlanning(params: {
    taskId: string;
    jobId: string;
  }): Promise<void> {
    const task = await this.taskRepository.findById(params.taskId);
    if (!task) {
      throw new Error(`Task ${params.taskId} not found`);
    }

    await task.startPlanning(params.jobId);
    await this.taskRepository.save(task);
  }

  /**
   * Complete planning phase
   */
  async completePlanning(params: {
    taskId: string;
    planContent: string;
  }): Promise<void> {
    const task = await this.taskRepository.findById(params.taskId);
    if (!task) {
      throw new Error(`Task ${params.taskId} not found`);
    }

    await task.completePlanning(params.planContent);
    await this.taskRepository.save(task);
  }

  /**
   * Start execution phase
   */
  async startExecution(params: {
    taskId: string;
    executionId: string;
    branchName: string;
  }): Promise<void> {
    const task = await this.taskRepository.findById(params.taskId);
    if (!task) {
      throw new Error(`Task ${params.taskId} not found`);
    }

    await task.startExecution({
      executionId: params.executionId,
      branchName: params.branchName,
    });
    await this.taskRepository.save(task);
  }

  /**
   * Complete execution phase
   */
  async completeExecution(params: {
    taskId: string;
    result: ExecutionResult;
  }): Promise<void> {
    const task = await this.taskRepository.findById(params.taskId);
    if (!task) {
      throw new Error(`Task ${params.taskId} not found`);
    }

    await task.completeExecution(params.result);
    await this.taskRepository.save(task);

    // Get dependent tasks before removing from graph
    const dependents = this.dependencyGraph.getDependents(params.taskId);

    // Remove dependencies (task is done, unblock dependent tasks)
    await this.dependencyGraph.removeAllDependenciesFor(params.taskId);

    // Update dependent tasks to remove this task from their blockedByIds
    for (const dep of dependents) {
      const dependentTask = await this.taskRepository.findById(dep.taskId);
      if (dependentTask) {
        dependentTask.removeBlockedBy(params.taskId);
        await this.taskRepository.save(dependentTask);
      }
    }
  }

  /**
   * Fail execution phase
   */
  async failExecution(params: {
    taskId: string;
    executionId: string;
    error: string;
  }): Promise<void> {
    const task = await this.taskRepository.findById(params.taskId);
    if (!task) {
      throw new Error(`Task ${params.taskId} not found`);
    }

    await task.failExecution({
      executionId: params.executionId,
      error: params.error,
    });
    await this.taskRepository.save(task);
  }

  /**
   * Mark task as stuck
   */
  async markStuck(params: { taskId: string; reason: string }): Promise<void> {
    const task = await this.taskRepository.findById(params.taskId);
    if (!task) {
      throw new Error(`Task ${params.taskId} not found`);
    }

    await task.markStuck(params.reason);
    await this.taskRepository.save(task);
  }

  /**
   * Update task priority
   */
  async updatePriority(params: {
    taskId: string;
    priority: number;
  }): Promise<void> {
    const task = await this.taskRepository.findById(params.taskId);
    if (!task) {
      throw new Error(`Task ${params.taskId} not found`);
    }

    await task.updatePriority(params.priority);
    await this.taskRepository.save(task);
  }

  /**
   * Update task configuration
   */
  async updateConfiguration(params: {
    taskId: string;
    configuration: Partial<TaskConfiguration>;
  }): Promise<void> {
    const task = await this.taskRepository.findById(params.taskId);
    if (!task) {
      throw new Error(`Task ${params.taskId} not found`);
    }

    task.updateConfiguration(params.configuration);
    await this.taskRepository.save(task);
  }

  /**
   * Add dependency (taskId is blocked by blockedById)
   */
  async addDependency(params: {
    taskId: string;
    blockedById: string;
  }): Promise<void> {
    // Add to dependency graph
    await this.dependencyGraph.addDependency(params);

    // Update task blocked by list
    const task = await this.taskRepository.findById(params.taskId);
    if (task) {
      task.addBlockedBy(params.blockedById);
      await this.taskRepository.save(task);
    }
  }

  /**
   * Remove dependency
   */
  async removeDependency(params: {
    taskId: string;
    blockedById: string;
  }): Promise<void> {
    // Remove from dependency graph
    await this.dependencyGraph.removeDependency(params);

    // Update task blocked by list
    const task = await this.taskRepository.findById(params.taskId);
    if (task) {
      task.removeBlockedBy(params.blockedById);
      await this.taskRepository.save(task);
    }
  }

  /**
   * Get task by ID
   */
  async getTask(taskId: string): Promise<{
    id: string;
    repositoryId: string;
    title: string;
    description?: string;
    status: string;
    priority: number;
    isBlocked: boolean;
    canExecute: boolean;
  } | null> {
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      return null;
    }

    const state = task.getState();
    return {
      id: state.id,
      repositoryId: state.repositoryId,
      title: state.metadata.title,
      description: state.metadata.description,
      status: state.status,
      priority: state.metadata.priority,
      isBlocked: task.isBlocked(),
      canExecute: task.canExecute(),
    };
  }

  /**
   * Check if task can execute
   */
  async canExecute(taskId: string): Promise<boolean> {
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      return false;
    }

    return task.canExecute();
  }

  /**
   * Update task metadata (title, description, etc.)
   */
  async updateMetadata(params: {
    taskId: string;
    metadata: Partial<TaskMetadata>;
  }): Promise<void> {
    const task = await this.taskRepository.findById(params.taskId);
    if (!task) {
      throw new Error(`Task ${params.taskId} not found`);
    }

    task.updateMetadata(params.metadata);
    await this.taskRepository.save(task);
  }

  /**
   * Update task status (direct transition)
   */
  async updateStatus(params: {
    taskId: string;
    status: TaskStatus;
    reason?: string;
  }): Promise<void> {
    const task = await this.taskRepository.findById(params.taskId);
    if (!task) {
      throw new Error(`Task ${params.taskId} not found`);
    }

    await task.transitionStatus(params.status, params.reason);
    await this.taskRepository.save(task);
  }

  /**
   * Delete task
   */
  async deleteTask(taskId: string): Promise<void> {
    // Remove from dependency graph first
    await this.dependencyGraph.removeAllDependenciesFor(taskId);

    // Delete from database
    const { db, tasks } = await import("@/lib/db");
    const { eq } = await import("drizzle-orm");
    await db.delete(tasks).where(eq(tasks.id, taskId));
  }

  /**
   * Get full task state (for API responses)
   */
  async getTaskFull(taskId: string): Promise<TaskApiResponse | null> {
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      return null;
    }

    const state = task.getState();

    // Use adapter to map to API format
    return TaskAdapter.toApiResponse(state);
  }
}
