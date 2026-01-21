/**
 * Dependency Graph - Manages task dependencies for parallel execution
 */

import type { PlanStep, TaskNode, DependencyGraph, ParsedPlan } from "@/lib/agents/types";

/**
 * Build a dependency graph from a list of plan steps
 */
export function buildDependencyGraph(steps: PlanStep[]): DependencyGraph {
  const nodes = new Map<string, TaskNode>();
  const roots: string[] = [];

  // First pass: create all nodes
  for (const step of steps) {
    nodes.set(step.id, {
      id: step.id,
      step,
      dependencies: [...step.dependencies],
      dependents: [],
      status: "pending",
    });
  }

  // Second pass: build dependent relationships
  for (const step of steps) {
    for (const depId of step.dependencies) {
      const depNode = nodes.get(depId);
      if (depNode) {
        depNode.dependents.push(step.id);
      }
    }
  }

  // Find root nodes (no dependencies)
  for (const [id, node] of nodes) {
    if (node.dependencies.length === 0) {
      roots.push(id);
    }
  }

  return {
    nodes,
    roots,
    validated: false,
  };
}

/**
 * Validate the graph has no cycles (using DFS)
 */
export function validateGraph(graph: DependencyGraph): { valid: boolean; error?: string } {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(nodeId: string): boolean {
    if (recursionStack.has(nodeId)) {
      return true; // Cycle detected
    }
    if (visited.has(nodeId)) {
      return false; // Already fully processed
    }

    visited.add(nodeId);
    recursionStack.add(nodeId);

    const node = graph.nodes.get(nodeId);
    if (node) {
      for (const depId of node.dependents) {
        if (hasCycle(depId)) {
          return true;
        }
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  // Check from all nodes
  for (const [nodeId] of graph.nodes) {
    if (!visited.has(nodeId)) {
      if (hasCycle(nodeId)) {
        return {
          valid: false,
          error: `Cycle detected involving node: ${nodeId}`,
        };
      }
    }
  }

  graph.validated = true;
  return { valid: true };
}

/**
 * Get tasks that are ready to execute (all dependencies completed)
 */
export function getReadyTasks(graph: DependencyGraph): TaskNode[] {
  const ready: TaskNode[] = [];

  for (const [, node] of graph.nodes) {
    if (node.status !== "pending") {
      continue;
    }

    // Check if all dependencies are completed
    const allDepsComplete = node.dependencies.every((depId) => {
      const depNode = graph.nodes.get(depId);
      return depNode?.status === "completed";
    });

    if (allDepsComplete) {
      ready.push(node);
    }
  }

  return ready;
}

/**
 * Mark a task as running
 */
export function markTaskRunning(graph: DependencyGraph, taskId: string): void {
  const node = graph.nodes.get(taskId);
  if (node) {
    node.status = "running";
  }
}

/**
 * Mark a task as completed
 */
export function markTaskCompleted(graph: DependencyGraph, taskId: string): void {
  const node = graph.nodes.get(taskId);
  if (node) {
    node.status = "completed";
  }
}

/**
 * Mark a task as failed
 */
export function markTaskFailed(graph: DependencyGraph, taskId: string): void {
  const node = graph.nodes.get(taskId);
  if (node) {
    node.status = "failed";
  }
}

/**
 * Mark a task as skipped (e.g., due to dependency failure)
 */
export function markTaskSkipped(graph: DependencyGraph, taskId: string): void {
  const node = graph.nodes.get(taskId);
  if (node) {
    node.status = "skipped";
  }
}

/**
 * Skip all tasks that depend on a failed task
 */
export function skipDependentTasks(graph: DependencyGraph, failedTaskId: string): string[] {
  const skipped: string[] = [];
  const toSkip = new Set<string>();

  // Find all tasks that transitively depend on the failed task
  function findDependents(taskId: string): void {
    const node = graph.nodes.get(taskId);
    if (!node) return;

    for (const dependentId of node.dependents) {
      if (!toSkip.has(dependentId)) {
        toSkip.add(dependentId);
        skipped.push(dependentId);
        findDependents(dependentId);
      }
    }
  }

  findDependents(failedTaskId);

  // Mark all as skipped
  for (const taskId of toSkip) {
    markTaskSkipped(graph, taskId);
  }

  return skipped;
}

/**
 * Check if all tasks are complete (completed, failed, or skipped)
 */
export function isGraphComplete(graph: DependencyGraph): boolean {
  for (const [, node] of graph.nodes) {
    if (node.status === "pending" || node.status === "running") {
      return false;
    }
  }
  return true;
}

/**
 * Check if there are any incomplete tasks
 */
export function hasIncompleteTasks(graph: DependencyGraph): boolean {
  return !isGraphComplete(graph);
}

/**
 * Get execution progress statistics
 */
export function getProgress(graph: DependencyGraph): {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  running: number;
  pending: number;
  progressPercent: number;
} {
  let completed = 0;
  let failed = 0;
  let skipped = 0;
  let running = 0;
  let pending = 0;

  for (const [, node] of graph.nodes) {
    switch (node.status) {
      case "completed":
        completed++;
        break;
      case "failed":
        failed++;
        break;
      case "skipped":
        skipped++;
        break;
      case "running":
        running++;
        break;
      case "pending":
        pending++;
        break;
    }
  }

  const total = graph.nodes.size;
  const done = completed + failed + skipped;
  const progressPercent = total > 0 ? Math.round((done / total) * 100) : 0;

  return { total, completed, failed, skipped, running, pending, progressPercent };
}

/**
 * Get topological order for sequential execution
 */
export function getTopologicalOrder(graph: DependencyGraph): string[] {
  const order: string[] = [];
  const visited = new Set<string>();
  const temp = new Set<string>();

  function visit(nodeId: string): void {
    if (visited.has(nodeId)) return;
    if (temp.has(nodeId)) throw new Error("Cycle detected");

    temp.add(nodeId);

    const node = graph.nodes.get(nodeId);
    if (node) {
      for (const depId of node.dependencies) {
        visit(depId);
      }
    }

    temp.delete(nodeId);
    visited.add(nodeId);
    order.push(nodeId);
  }

  for (const [nodeId] of graph.nodes) {
    if (!visited.has(nodeId)) {
      visit(nodeId);
    }
  }

  return order;
}

/**
 * Identify parallel execution groups (tasks that can run concurrently)
 */
export function getParallelGroups(graph: DependencyGraph): string[][] {
  const groups: string[][] = [];
  const assigned = new Set<string>();
  const order = getTopologicalOrder(graph);

  // Calculate depth for each node
  const depths = new Map<string, number>();

  function getDepth(nodeId: string): number {
    if (depths.has(nodeId)) {
      return depths.get(nodeId)!;
    }

    const node = graph.nodes.get(nodeId);
    if (!node || node.dependencies.length === 0) {
      depths.set(nodeId, 0);
      return 0;
    }

    const maxDepDepth = Math.max(
      ...node.dependencies.map((depId) => getDepth(depId))
    );
    const depth = maxDepDepth + 1;
    depths.set(nodeId, depth);
    return depth;
  }

  // Calculate depths for all nodes
  for (const nodeId of order) {
    getDepth(nodeId);
  }

  // Group by depth
  const maxDepth = Math.max(...depths.values());
  for (let d = 0; d <= maxDepth; d++) {
    const group: string[] = [];
    for (const [nodeId, depth] of depths) {
      if (depth === d && !assigned.has(nodeId)) {
        group.push(nodeId);
        assigned.add(nodeId);
      }
    }
    if (group.length > 0) {
      groups.push(group);
    }
  }

  return groups;
}

/**
 * Parse a plan from JSON or markdown format
 */
export function parsePlan(planContent: string): ParsedPlan {
  // Try JSON first
  try {
    const parsed = JSON.parse(planContent);
    if (parsed.steps && Array.isArray(parsed.steps)) {
      // Ensure each step has required fields and dependencies
      const steps: PlanStep[] = parsed.steps.map((step: unknown, index: number) => {
        const s = step as Record<string, unknown>;
        return {
          id: (s.id as string) || `step-${index + 1}`,
          title: (s.title as string) || `Step ${index + 1}`,
          description: (s.description as string) || "",
          dependencies: (s.dependencies as string[]) || [],
          complexity: s.complexity as PlanStep["complexity"],
          tags: s.tags as string[],
        };
      });

      return {
        steps,
        title: parsed.title,
        description: parsed.description,
      };
    }
  } catch {
    // Not JSON, try parsing as markdown
  }

  // Parse as markdown (numbered list or bullet points)
  const lines = planContent.split("\n");
  const steps: PlanStep[] = [];
  let currentStep: Partial<PlanStep> | null = null;

  for (const line of lines) {
    // Match numbered list items: "1. " or "1) "
    const numberedMatch = line.match(/^\s*(\d+)[.)]\s+(.+)/);
    // Match bullet points: "- " or "* "
    const bulletMatch = line.match(/^\s*[-*]\s+(.+)/);

    if (numberedMatch) {
      if (currentStep) {
        steps.push(currentStep as PlanStep);
      }
      currentStep = {
        id: `step-${steps.length + 1}`,
        title: numberedMatch[2].trim(),
        description: "",
        dependencies: steps.length > 0 ? [`step-${steps.length}`] : [], // Sequential by default
      };
    } else if (bulletMatch) {
      // Each bullet creates a new step
      if (currentStep) {
        steps.push(currentStep as PlanStep);
      }
      currentStep = {
        id: `step-${steps.length + 1}`,
        title: bulletMatch[1].trim(),
        description: "",
        dependencies: steps.length > 0 ? [`step-${steps.length}`] : [],
      };
    } else if (currentStep && line.trim()) {
      // Add to description
      currentStep.description = (currentStep.description || "") + " " + line.trim();
    }
  }

  if (currentStep) {
    steps.push(currentStep as PlanStep);
  }

  // If no steps found, treat entire content as a single step
  if (steps.length === 0) {
    steps.push({
      id: "step-1",
      title: "Execute task",
      description: planContent,
      dependencies: [],
    });
  }

  return { steps };
}
