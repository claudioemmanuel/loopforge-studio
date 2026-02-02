import type { Node, Edge } from "@xyflow/react";
import type { Task } from "@/lib/db/schema";
import type { ExecutionGraph } from "@/lib/execution/graph-types";

const COLUMN_WIDTH = 400;
const NODE_HEIGHT = 180;
const VERTICAL_GAP = 60;
const EXECUTION_STEP_HEIGHT = 50;
const EXECUTION_STEP_OFFSET_X = 40;
const EXECUTION_STEP_OFFSET_Y = 120;

const STATUS_ORDER = [
  "todo",
  "brainstorming",
  "planning",
  "ready",
  "executing",
  "review",
  "done",
  "stuck",
] as const;

export interface DependencyMap {
  [taskId: string]: {
    blockedBy: string[];
    blocks: string[];
  };
}

export interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
}

/**
 * Calculate graph layout for repository view
 * Uses hybrid constrained layout: horizontal by status, vertical by dependencies
 */
export function calculateGraphLayout(
  tasks: Task[],
  dependencies: DependencyMap,
  expandedNodes: Set<string>,
  executions: Map<string, ExecutionGraph>,
): LayoutResult {
  // Group tasks by status
  const columns = STATUS_ORDER.map((status) => ({
    status,
    tasks: tasks.filter((t) => t.status === status),
  }));

  // Sort tasks within each column by dependencies (topological sort)
  columns.forEach((column) => {
    column.tasks = topologicalSort(column.tasks, dependencies);
  });

  // Position nodes
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  columns.forEach((column, colIndex) => {
    column.tasks.forEach((task, taskIndex) => {
      const x = colIndex * COLUMN_WIDTH;
      const y = taskIndex * (NODE_HEIGHT + VERTICAL_GAP);

      // Add task node
      nodes.push({
        id: task.id,
        type: "task",
        position: { x, y },
        data: {
          task,
          isExpanded: expandedNodes.has(task.id),
        },
      });

      // Add execution step nodes if expanded
      if (expandedNodes.has(task.id) && executions.has(task.id)) {
        const executionGraph = executions.get(task.id)!;
        executionGraph.nodes.forEach((step, stepIndex) => {
          nodes.push({
            id: `${task.id}-step-${step.id}`,
            type: "executionStep",
            position: {
              x: x + EXECUTION_STEP_OFFSET_X,
              y:
                y +
                EXECUTION_STEP_OFFSET_Y +
                stepIndex * (EXECUTION_STEP_HEIGHT + 10),
            },
            data: { step, taskId: task.id },
            parentId: task.id,
          });
        });

        // Add execution step edges
        executionGraph.edges.forEach((edge) => {
          edges.push({
            id: `${task.id}-edge-${edge.from}-${edge.to}`,
            source: `${task.id}-step-${edge.from}`,
            target: `${task.id}-step-${edge.to}`,
            type: "smoothstep",
            style: { stroke: "#6366f1", strokeWidth: 2 },
            animated: false,
          });
        });
      }

      // Add dependency edges (task to task)
      const deps = dependencies[task.id];
      if (deps?.blockedBy) {
        deps.blockedBy.forEach((depId) => {
          edges.push({
            id: `dep-${depId}-${task.id}`,
            source: depId,
            target: task.id,
            type: "smoothstep",
            style: { strokeDasharray: "5 5", stroke: "#9ca3af" },
            animated: false,
            label: "blocks",
          });
        });
      }
    });
  });

  return { nodes, edges };
}

/**
 * Topological sort using Kahn's algorithm
 * Sorts tasks by dependencies within the same status column
 */
function topologicalSort(tasks: Task[], dependencies: DependencyMap): Task[] {
  if (tasks.length === 0) return [];

  const inDegree = new Map<string, number>();
  const graph = new Map<string, string[]>();
  const taskMap = new Map<string, Task>();

  // Initialize graph
  tasks.forEach((task) => {
    inDegree.set(task.id, 0);
    graph.set(task.id, []);
    taskMap.set(task.id, task);
  });

  // Build graph and calculate in-degrees (only for tasks in same status)
  tasks.forEach((task) => {
    const deps = dependencies[task.id];
    if (deps?.blockedBy) {
      // Only count dependencies that are in the same status column
      const sameLaneDeps = deps.blockedBy.filter((depId) => {
        const depTask = taskMap.get(depId);
        return depTask && depTask.status === task.status;
      });

      inDegree.set(task.id, sameLaneDeps.length);

      sameLaneDeps.forEach((depId) => {
        if (graph.has(depId)) {
          graph.get(depId)!.push(task.id);
        }
      });
    }
  });

  // Kahn's algorithm
  const queue: string[] = [];
  tasks.forEach((task) => {
    if (inDegree.get(task.id) === 0) {
      queue.push(task.id);
    }
  });

  const sorted: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    sorted.push(id);

    const neighbors = graph.get(id) || [];
    neighbors.forEach((neighborId) => {
      const newDegree = (inDegree.get(neighborId) || 0) - 1;
      inDegree.set(neighborId, newDegree);
      if (newDegree === 0) {
        queue.push(neighborId);
      }
    });
  }

  // If sorted length doesn't match tasks, there's a cycle (or cross-lane deps)
  // In that case, return original order
  if (sorted.length !== tasks.length) {
    console.warn("Circular dependency or cross-lane dependency detected");
    return tasks;
  }

  return sorted.map((id) => taskMap.get(id)!).filter(Boolean);
}

/**
 * Build dependency map from tasks
 */
export function buildDependencyMap(tasks: Task[]): DependencyMap {
  const map: DependencyMap = {};

  tasks.forEach((task) => {
    if (!map[task.id]) {
      map[task.id] = { blockedBy: [], blocks: [] };
    }

    // Add blockedBy relationships
    const blockedByIds = task.blockedByIds || [];
    map[task.id].blockedBy = blockedByIds;

    // Add reverse blocks relationships
    blockedByIds.forEach((depId) => {
      if (!map[depId]) {
        map[depId] = { blockedBy: [], blocks: [] };
      }
      map[depId].blocks.push(task.id);
    });
  });

  return map;
}
