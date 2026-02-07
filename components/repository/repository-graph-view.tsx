"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  type Node,
  type Edge,
  type NodeTypes,
  MiniMap,
} from "@xyflow/react";
import { TaskLifecycleNode } from "./task-lifecycle-node";
import { GraphSidePanel } from "./graph-side-panel";
import { buildDependencyMap } from "@/lib/shared/graph-layout";
import {
  buildTaskLifecycleGraph,
  type TaskLifecycleGraph,
  type TaskLifecycleNode as LifecycleNode,
} from "@/lib/shared/task-lifecycle-graph";
import type { Task } from "@/lib/db/schema";
import { GitBranch, Loader2 } from "lucide-react";
import "@xyflow/react/dist/style.css";

const ROW_HEIGHT = 190;
const COLUMN_WIDTH = 310;

interface RepositoryGraphViewProps {
  repositoryId: string;
}

interface GraphRouteResponse {
  tasks: Task[];
  dependencies: ReturnType<typeof buildDependencyMap>;
  lifecycle?: TaskLifecycleGraph;
}

function compareLifecycleNodesByTimestamp(
  first: LifecycleNode,
  second: LifecycleNode,
): number {
  return (
    new Date(first.timestamp).getTime() - new Date(second.timestamp).getTime()
  );
}

function statusColor(status: Task["status"]): string {
  const statusColors: Record<Task["status"], string> = {
    todo: "#6b7280",
    brainstorming: "#a855f7",
    planning: "#3b82f6",
    ready: "#eab308",
    executing: "#f97316",
    review: "#06b6d4",
    done: "#22c55e",
    stuck: "#ef4444",
  };

  return statusColors[status];
}

export function RepositoryGraphView({
  repositoryId,
}: RepositoryGraphViewProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [lifecycleGraph, setLifecycleGraph] = useState<TaskLifecycleGraph>({
    nodes: [],
    edges: [],
  });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGraphData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/repos/${repositoryId}/graph`);
        if (!response.ok) {
          throw new Error("Failed to fetch graph data");
        }

        const data = (await response.json()) as GraphRouteResponse;
        const dependencies =
          data.dependencies ?? buildDependencyMap(data.tasks);

        setTasks(data.tasks);
        setLifecycleGraph(
          data.lifecycle ?? buildTaskLifecycleGraph(data.tasks, dependencies),
        );
      } catch (fetchError) {
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "An error occurred",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchGraphData();
  }, [repositoryId]);

  const tasksById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  );

  const lifecycleNodesByTask = useMemo(() => {
    const grouped = new Map<string, LifecycleNode[]>();

    for (const lifecycleNode of lifecycleGraph.nodes) {
      const current = grouped.get(lifecycleNode.taskId) ?? [];
      current.push(lifecycleNode);
      grouped.set(lifecycleNode.taskId, current);
    }

    for (const [taskId, nodes] of grouped) {
      grouped.set(taskId, [...nodes].sort(compareLifecycleNodesByTimestamp));
    }

    return grouped;
  }, [lifecycleGraph.nodes]);

  const orderedTaskIds = useMemo(() => {
    const fallback = tasks.map((task) => task.id);
    const ids = Array.from(lifecycleNodesByTask.keys());
    if (ids.length === 0) return fallback;

    return ids.sort((a, b) => {
      const taskA = tasksById.get(a);
      const taskB = tasksById.get(b);
      if (!taskA || !taskB) return a.localeCompare(b);
      return (
        new Date(taskA.createdAt).getTime() -
        new Date(taskB.createdAt).getTime()
      );
    });
  }, [lifecycleNodesByTask, tasks, tasksById]);

  const flowNodes = useMemo<Node[]>(() => {
    const nodes: Node[] = [];

    orderedTaskIds.forEach((taskId, taskIndex) => {
      const task = tasksById.get(taskId);
      if (!task) return;

      const lifecycleNodes = lifecycleNodesByTask.get(taskId) ?? [];
      lifecycleNodes.forEach((lifecycleNode, nodeIndex) => {
        nodes.push({
          id: lifecycleNode.id,
          type: "lifecycle",
          position: {
            x: nodeIndex * COLUMN_WIDTH,
            y: taskIndex * ROW_HEIGHT,
          },
          data: {
            event: lifecycleNode,
            task,
            isSelected: selectedNodeId === lifecycleNode.id,
          },
        });
      });
    });

    return nodes;
  }, [orderedTaskIds, tasksById, lifecycleNodesByTask, selectedNodeId]);

  const flowEdges = useMemo<Edge[]>(() => {
    return lifecycleGraph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: "smoothstep",
      label: edge.type === "dependency" ? "blocks" : undefined,
      animated: false,
      style:
        edge.type === "dependency"
          ? { strokeDasharray: "5 5", stroke: "#9ca3af" }
          : { stroke: "#4b5563", strokeWidth: 2 },
    }));
  }, [lifecycleGraph.edges]);

  const lifecycleNodeMap = useMemo(
    () => new Map(lifecycleGraph.nodes.map((node) => [node.id, node])),
    [lifecycleGraph.nodes],
  );

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const nodeTypes: NodeTypes = useMemo(
    () => ({
      lifecycle: TaskLifecycleNode,
    }),
    [],
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading graph...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-md text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <GitBranch className="h-6 w-6 text-destructive" />
            </div>
          </div>
          <h3 className="mb-2 font-semibold">Failed to load graph</h3>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-md text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <GitBranch className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
          <h3 className="mb-2 font-semibold">No tasks yet</h3>
          <p className="text-sm text-muted-foreground">
            Create your first task to see it visualized here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        fitView
        minZoom={0.1}
        maxZoom={2}
        nodesDraggable={false}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const lifecycleNode = lifecycleNodeMap.get(node.id);
            if (!lifecycleNode) return "#9ca3af";
            return statusColor(lifecycleNode.toStatus);
          }}
          className="!border-border !bg-background"
        />
      </ReactFlow>

      {selectedNodeId ? (
        <GraphSidePanel
          nodeId={selectedNodeId}
          tasks={tasks}
          lifecycleNodes={lifecycleGraph.nodes}
          onClose={handleClosePanel}
        />
      ) : null}
    </div>
  );
}
