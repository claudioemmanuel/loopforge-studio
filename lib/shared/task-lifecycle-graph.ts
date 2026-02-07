import type { StatusHistoryEntry, Task, TaskStatus } from "@/lib/db/schema";

export type LifecycleEdgeType = "timeline" | "dependency";
export type LifecycleNodeKind = "created" | "transition" | "current";
export type LifecycleTriggeredBy = StatusHistoryEntry["triggeredBy"] | "system";

export interface TaskLifecycleNode {
  id: string;
  taskId: string;
  kind: LifecycleNodeKind;
  title: string;
  description: string;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus;
  timestamp: string;
  triggeredBy: LifecycleTriggeredBy;
}

export interface TaskLifecycleEdge {
  id: string;
  source: string;
  target: string;
  type: LifecycleEdgeType;
  sourceTaskId: string;
  targetTaskId: string;
}

export interface TaskLifecycleGraph {
  nodes: TaskLifecycleNode[];
  edges: TaskLifecycleEdge[];
}

export interface TaskDependencyMap {
  [taskId: string]: {
    blockedBy: string[];
    blocks: string[];
  };
}

function toIsoTimestamp(value: Date | string | null | undefined): string {
  if (!value) return new Date(0).toISOString();
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString();
}

function createCreatedNode(
  task: Task,
  startingStatus: TaskStatus,
): TaskLifecycleNode {
  return {
    id: `${task.id}::created`,
    taskId: task.id,
    kind: "created",
    title: "Task created",
    description: "Task entered the workflow.",
    fromStatus: null,
    toStatus: startingStatus,
    timestamp: toIsoTimestamp(task.createdAt),
    triggeredBy: "user",
  };
}

function createTransitionNode(
  taskId: string,
  entry: StatusHistoryEntry,
  index: number,
): TaskLifecycleNode {
  return {
    id: `${taskId}::transition-${index}`,
    taskId,
    kind: "transition",
    title: `Moved to ${entry.to}`,
    description: entry.from
      ? `Status changed from ${entry.from} to ${entry.to}.`
      : `Status changed to ${entry.to}.`,
    fromStatus: entry.from,
    toStatus: entry.to,
    timestamp: toIsoTimestamp(entry.timestamp),
    triggeredBy: entry.triggeredBy,
  };
}

function createCurrentNode(
  task: Task,
  fromStatus: TaskStatus | null,
): TaskLifecycleNode {
  return {
    id: `${task.id}::current`,
    taskId: task.id,
    kind: "current",
    title: `Current: ${task.status}`,
    description: `Task currently in ${task.status}.`,
    fromStatus,
    toStatus: task.status,
    timestamp: toIsoTimestamp(task.updatedAt),
    triggeredBy: "system",
  };
}

function sortStatusHistory(
  statusHistory: StatusHistoryEntry[],
): StatusHistoryEntry[] {
  return [...statusHistory].sort((a, b) => {
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });
}

export function buildTaskLifecycleGraph(
  tasks: Task[],
  dependencies?: TaskDependencyMap,
): TaskLifecycleGraph {
  const nodes: TaskLifecycleNode[] = [];
  const edges: TaskLifecycleEdge[] = [];
  const taskNodeIds = new Map<string, string[]>();

  for (const task of tasks) {
    const history = sortStatusHistory(
      (task.statusHistory ?? []) as StatusHistoryEntry[],
    );
    const nodeIds: string[] = [];

    const startingStatus = history[0]?.from ?? task.status;
    const createdNode = createCreatedNode(task, startingStatus);
    nodes.push(createdNode);
    nodeIds.push(createdNode.id);

    history.forEach((entry, index) => {
      const transitionNode = createTransitionNode(task.id, entry, index);
      nodes.push(transitionNode);
      nodeIds.push(transitionNode.id);
    });

    const latestHistoryStatus =
      history[history.length - 1]?.to ?? startingStatus;
    if (history.length === 0 || latestHistoryStatus !== task.status) {
      const currentNode = createCurrentNode(task, latestHistoryStatus);
      nodes.push(currentNode);
      nodeIds.push(currentNode.id);
    }

    for (let index = 1; index < nodeIds.length; index += 1) {
      edges.push({
        id: `${task.id}::timeline-${index - 1}-${index}`,
        source: nodeIds[index - 1],
        target: nodeIds[index],
        type: "timeline",
        sourceTaskId: task.id,
        targetTaskId: task.id,
      });
    }

    taskNodeIds.set(task.id, nodeIds);
  }

  for (const task of tasks) {
    const blockedByIds =
      dependencies?.[task.id]?.blockedBy ?? task.blockedByIds ?? [];
    const taskEntryNodes = taskNodeIds.get(task.id);
    const taskStartNode = taskEntryNodes?.[0];

    if (!taskStartNode) continue;

    for (const dependencyTaskId of blockedByIds) {
      const dependencyNodes = taskNodeIds.get(dependencyTaskId);
      const dependencyEndNode = dependencyNodes?.[dependencyNodes.length - 1];
      if (!dependencyEndNode) continue;

      edges.push({
        id: `${dependencyTaskId}::blocks::${task.id}`,
        source: dependencyEndNode,
        target: taskStartNode,
        type: "dependency",
        sourceTaskId: dependencyTaskId,
        targetTaskId: task.id,
      });
    }
  }

  return { nodes, edges };
}
