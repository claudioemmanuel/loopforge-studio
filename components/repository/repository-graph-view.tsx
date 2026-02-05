"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  type Node,
  type NodeTypes,
  MiniMap,
} from "@xyflow/react";
import { TaskGraphNode } from "./task-graph-node";
import { ExecutionStepNode } from "./execution-step-node";
import { GraphSidePanel } from "./graph-side-panel";
import {
  calculateGraphLayout,
  buildDependencyMap,
} from "@/lib/shared/graph-layout";
import type { Task } from "@/lib/db/schema";
import type { ExecutionGraph } from "@/lib/shared/graph-types";
import { GitBranch, Loader2 } from "lucide-react";
import "@xyflow/react/dist/style.css";

interface RepositoryGraphViewProps {
  repositoryId: string;
}

export function RepositoryGraphView({
  repositoryId,
}: RepositoryGraphViewProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dependencies, setDependencies] = useState<
    ReturnType<typeof buildDependencyMap>
  >({});
  const [executions, setExecutions] = useState<Map<string, ExecutionGraph>>(
    new Map(),
  );
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial data
  useEffect(() => {
    const fetchGraphData = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/repos/${repositoryId}/graph`);
        if (!res.ok) {
          throw new Error("Failed to fetch graph data");
        }
        const data = await res.json();

        setTasks(data.tasks);
        setDependencies(data.dependencies);
        setExecutions(new Map(Object.entries(data.executions || {})));

        // Auto-expand executing/stuck/failed tasks
        const autoExpand = data.tasks
          .filter((t: Task) =>
            ["executing", "stuck", "failed", "review"].includes(t.status),
          )
          .map((t: Task) => t.id);
        setExpandedNodes(new Set(autoExpand));
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchGraphData();
  }, [repositoryId]);

  // Toggle node expansion
  const handleToggleExpand = useCallback((taskId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  // Calculate layout
  const { nodes, edges } = useMemo(() => {
    return calculateGraphLayout(tasks, dependencies, expandedNodes, executions);
  }, [tasks, dependencies, expandedNodes, executions]);

  // Enhance nodes with interaction handlers
  const enhancedNodes = useMemo(() => {
    return nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        onToggleExpand: () => handleToggleExpand(node.id),
        isSelected: selectedNodeId === node.id,
      },
    }));
  }, [nodes, selectedNodeId, handleToggleExpand]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const nodeTypes: NodeTypes = useMemo(
    () => ({
      task: TaskGraphNode,
      executionStep: ExecutionStepNode,
    }),
    [],
  );

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading graph...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <GitBranch className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <h3 className="font-semibold mb-2">Failed to load graph</h3>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <GitBranch className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold mb-2">No tasks yet</h3>
            <p className="text-sm text-muted-foreground">
              Create your first task to see it visualized here
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={enhancedNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: "smoothstep",
        }}
      >
        <Background />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const task = tasks.find((t) => t.id === node.id);
            if (!task) return "#9ca3af";

            const statusColors: Record<string, string> = {
              todo: "#6b7280",
              brainstorming: "#a855f7",
              planning: "#3b82f6",
              ready: "#eab308",
              executing: "#f97316",
              review: "#06b6d4",
              done: "#22c55e",
              stuck: "#ef4444",
            };

            return statusColors[task.status] || "#9ca3af";
          }}
          className="!bg-background !border-border"
        />
      </ReactFlow>

      {selectedNodeId && (
        <GraphSidePanel
          nodeId={selectedNodeId}
          tasks={tasks}
          executions={executions}
          onClose={handleClosePanel}
        />
      )}
    </div>
  );
}
