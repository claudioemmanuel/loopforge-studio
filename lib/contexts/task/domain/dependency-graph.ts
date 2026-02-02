/**
 * Task Dependency Graph Aggregate
 *
 * Manages task dependencies and ensures no circular dependencies.
 * Implements DAG (Directed Acyclic Graph) validation.
 */

import { EventPublisher } from "@/lib/contexts/domain-events";
import type { Redis } from "ioredis";
import type {
  DependencyAddedEvent,
  DependencyRemovedEvent,
  TaskUnblockedEvent,
} from "./events";

/**
 * Dependency relationship
 */
export interface Dependency {
  taskId: string;
  blockedById: string;
  createdAt: Date;
}

/**
 * Task dependency graph state
 */
export interface DependencyGraphState {
  dependencies: Dependency[];
}

/**
 * Task Dependency Graph aggregate
 *
 * Enforces invariants:
 * - No circular dependencies
 * - All blocked tasks reference valid tasks
 * - Dependency relationships are unique
 */
export class TaskDependencyGraph {
  private state: DependencyGraphState;
  private eventPublisher: EventPublisher;

  constructor(state: DependencyGraphState, redis: Redis) {
    this.state = state;
    this.eventPublisher = EventPublisher.getInstance(redis);
  }

  /**
   * Create a new dependency graph
   */
  static create(redis: Redis): TaskDependencyGraph {
    const state: DependencyGraphState = {
      dependencies: [],
    };

    return new TaskDependencyGraph(state, redis);
  }

  /**
   * Add dependency (taskId is blocked by blockedById)
   */
  async addDependency(params: {
    taskId: string;
    blockedById: string;
  }): Promise<void> {
    const { taskId, blockedById } = params;

    // Cannot depend on self
    if (taskId === blockedById) {
      throw new Error("Task cannot depend on itself");
    }

    // Check if dependency already exists
    const existing = this.state.dependencies.find(
      (d) => d.taskId === taskId && d.blockedById === blockedById,
    );

    if (existing) {
      return; // Already exists, no-op
    }

    // Check for circular dependencies
    if (this.wouldCreateCycle(taskId, blockedById)) {
      throw new Error(
        `Adding dependency would create a cycle: ${taskId} -> ${blockedById}`,
      );
    }

    // Add dependency
    const dependency: Dependency = {
      taskId,
      blockedById,
      createdAt: new Date(),
    };

    this.state.dependencies.push(dependency);

    // Publish DependencyAdded event
    const event: DependencyAddedEvent = {
      id: crypto.randomUUID(),
      eventType: "DependencyAdded",
      aggregateType: "Task",
      aggregateId: taskId,
      occurredAt: new Date(),
      data: {
        taskId,
        blockedById,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await this.eventPublisher.publish(event);
  }

  /**
   * Remove dependency
   */
  async removeDependency(params: {
    taskId: string;
    blockedById: string;
  }): Promise<void> {
    const { taskId, blockedById } = params;

    const index = this.state.dependencies.findIndex(
      (d) => d.taskId === taskId && d.blockedById === blockedById,
    );

    if (index === -1) {
      return; // Doesn't exist, no-op
    }

    // Remove dependency
    this.state.dependencies.splice(index, 1);

    // Publish DependencyRemoved event
    const event: DependencyRemovedEvent = {
      id: crypto.randomUUID(),
      eventType: "DependencyRemoved",
      aggregateType: "Task",
      aggregateId: taskId,
      occurredAt: new Date(),
      data: {
        taskId,
        blockedById,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await this.eventPublisher.publish(event);

    // Check if task is now unblocked
    const remainingDeps = this.getDependencies(taskId);
    if (remainingDeps.length === 0) {
      // Task is now unblocked
      const unblockedEvent: TaskUnblockedEvent = {
        id: crypto.randomUUID(),
        eventType: "TaskUnblocked",
        aggregateType: "Task",
        aggregateId: taskId,
        occurredAt: new Date(),
        data: {
          taskId,
          resolvedDependencies: [blockedById],
        },
        metadata: {
          correlationId: crypto.randomUUID(),
        },
      };

      await this.eventPublisher.publish(unblockedEvent);
    }
  }

  /**
   * Remove all dependencies for a task (when task completes)
   */
  async removeAllDependenciesFor(taskId: string): Promise<void> {
    // Find tasks that depend on this task
    const dependentTasks = this.state.dependencies
      .filter((d) => d.blockedById === taskId)
      .map((d) => d.taskId);

    // Remove dependencies
    this.state.dependencies = this.state.dependencies.filter(
      (d) => d.blockedById !== taskId,
    );

    // Check which tasks are now unblocked
    for (const dependentTaskId of dependentTasks) {
      const remainingDeps = this.getDependencies(dependentTaskId);
      if (remainingDeps.length === 0) {
        // Task is now unblocked
        const event: TaskUnblockedEvent = {
          id: crypto.randomUUID(),
          eventType: "TaskUnblocked",
          aggregateType: "Task",
          aggregateId: dependentTaskId,
          occurredAt: new Date(),
          data: {
            taskId: dependentTaskId,
            resolvedDependencies: [taskId],
          },
          metadata: {
            correlationId: crypto.randomUUID(),
          },
        };

        await this.eventPublisher.publish(event);
      }
    }
  }

  /**
   * Get dependencies for a task
   */
  getDependencies(taskId: string): Dependency[] {
    return this.state.dependencies.filter((d) => d.taskId === taskId);
  }

  /**
   * Get tasks that depend on this task
   */
  getDependents(taskId: string): Dependency[] {
    return this.state.dependencies.filter((d) => d.blockedById === taskId);
  }

  /**
   * Check if adding dependency would create a cycle
   */
  private wouldCreateCycle(taskId: string, blockedById: string): boolean {
    // Use DFS to detect cycle
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (currentId: string): boolean => {
      visited.add(currentId);
      recursionStack.add(currentId);

      // Get dependencies of current task (what it's blocked by)
      const deps = this.state.dependencies
        .filter((d) => d.taskId === currentId)
        .map((d) => d.blockedById);

      // Add the new dependency if we're checking the initial task
      if (currentId === taskId) {
        deps.push(blockedById);
      }

      for (const depId of deps) {
        if (!visited.has(depId)) {
          if (hasCycle(depId)) {
            return true;
          }
        } else if (recursionStack.has(depId)) {
          // Found a back edge - cycle detected
          return true;
        }
      }

      recursionStack.delete(currentId);
      return false;
    };

    return hasCycle(taskId);
  }

  /**
   * Get topologically sorted tasks (for execution order)
   */
  getTopologicalOrder(taskIds: string[]): string[] {
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();

    // Initialize
    for (const taskId of taskIds) {
      inDegree.set(taskId, 0);
      adjList.set(taskId, []);
    }

    // Build graph
    for (const dep of this.state.dependencies) {
      if (taskIds.includes(dep.taskId) && taskIds.includes(dep.blockedById)) {
        // dep.taskId depends on dep.blockedById
        // So dep.blockedById must come before dep.taskId
        adjList.get(dep.blockedById)?.push(dep.taskId);
        inDegree.set(dep.taskId, (inDegree.get(dep.taskId) || 0) + 1);
      }
    }

    // Kahn's algorithm
    const queue: string[] = [];
    const result: string[] = [];

    // Start with tasks that have no dependencies
    for (const [taskId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(taskId);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      const neighbors = adjList.get(current) || [];
      for (const neighbor of neighbors) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);

        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    return result;
  }

  /**
   * Check if task is blocked
   */
  isBlocked(taskId: string): boolean {
    return this.getDependencies(taskId).length > 0;
  }

  /**
   * Get all dependencies (for persistence)
   */
  getAllDependencies(): Dependency[] {
    return [...this.state.dependencies];
  }
}
