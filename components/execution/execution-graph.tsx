"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  type Edge,
  type NodeTypes,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { ExecutionGraph, GraphNode } from "@/lib/shared/graph-types";
import { ZOOM_CONFIG } from "@/lib/shared/graph-types";
import { GraphControls } from "./graph-controls";
import { GraphLegend } from "./graph-legend";
import { GraphNodeTooltip } from "./graph-node-tooltip";
import { useGraphRealtime } from "./use-graph-realtime";
import { useGraphKeyboard } from "./use-graph-keyboard";
import { GraphAnnouncer, prefersReducedMotion } from "./graph-accessibility";
import { GraphKeyboardHelp } from "./graph-keyboard-help";
import { useGraphLayout } from "./use-graph-layout";
import {
  GraphFlowNode,
  type ExecutionFlowNode,
  type ExecutionFlowNodeData,
} from "./graph-flow-node";

/**
 * Props for ExecutionGraph component
 */
export interface ExecutionGraphProps {
  taskId: string;
  executionGraph: ExecutionGraph | null | undefined;
  onNodeClick?: (node: GraphNode) => void;
  onGraphUpdate?: (graph: ExecutionGraph) => void;
  enableRealtime?: boolean;
  compact?: boolean;
  showMinimap?: boolean;
  showLegend?: boolean;
  showControls?: boolean;
  className?: string;
}

const NODE_TYPES: NodeTypes = {
  executionNode: GraphFlowNode,
};

const STATUS_MINIMAP_COLORS: Record<GraphNode["status"], string> = {
  pending: "#475569",
  "in-progress": "#3b82f6",
  complete: "#10b981",
  failed: "#ef4444",
  stuck: "#dc2626",
};

function getEdgeColor(
  status: GraphNode["status"],
  highlighted: boolean,
): string {
  if (highlighted) {
    return "#10b981";
  }

  switch (status) {
    case "pending":
      return "#475569";
    case "in-progress":
      return "#3b82f6";
    case "complete":
      return "#10b981";
    case "failed":
    case "stuck":
      return "#ef4444";
    default:
      return "#475569";
  }
}

/**
 * Main execution graph visualization component
 * Renders a DAG showing task execution flow with nodes and edges
 */
export function ExecutionGraph({
  taskId,
  executionGraph,
  onNodeClick,
  onGraphUpdate,
  enableRealtime = false,
  compact = false,
  showMinimap = true,
  showLegend = true,
  showControls = true,
  className = "",
}: ExecutionGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [flowInstance, setFlowInstance] =
    useState<ReactFlowInstance<ExecutionFlowNode> | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(ZOOM_CONFIG.default);

  // Calculate layout
  const layout = useGraphLayout(executionGraph);

  // Real-time updates via SSE
  const { isConnected, updatedNodeIds } = useGraphRealtime({
    taskId,
    executionGraph: executionGraph ?? null,
    onGraphUpdate,
    enabled: enableRealtime,
  });

  // Keyboard navigation
  const { focusedNodeIndex } = useGraphKeyboard({
    nodes: layout?.nodes || [],
    onNodeSelect: (node) => {
      setSelectedNodeId(node.id);
      setHoveredNode(node);
    },
    enabled: !!layout,
  });

  // Accessibility announcer
  const announcerRef = useRef<GraphAnnouncer | null>(null);

  useEffect(() => {
    announcerRef.current = new GraphAnnouncer();
    return () => {
      announcerRef.current?.destroy();
    };
  }, []);

  useEffect(() => {
    if (enableRealtime) {
      announcerRef.current?.announceConnectionStatus(isConnected);
    }
  }, [isConnected, enableRealtime]);

  const reducedMotion = prefersReducedMotion();
  const focusedNodeId =
    layout && layout.nodes[focusedNodeIndex]
      ? layout.nodes[focusedNodeIndex].id
      : null;

  const handleNodeHover = useCallback(
    (node: GraphNode | null, event?: React.MouseEvent) => {
      setHoveredNode(node);
      if (event) {
        setMousePosition({ x: event.clientX, y: event.clientY });
      }
    },
    [],
  );

  const handleNodeActivate = useCallback(
    (node: GraphNode, event: React.MouseEvent | React.KeyboardEvent) => {
      setSelectedNodeId(node.id);
      setHoveredNode(node);

      if ("clientX" in event && "clientY" in event) {
        setMousePosition({ x: event.clientX, y: event.clientY });
      } else {
        const rect = event.currentTarget.getBoundingClientRect();
        setMousePosition({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        });
      }

      onNodeClick?.(node);
    },
    [onNodeClick],
  );

  const flowNodes = useMemo<ExecutionFlowNode[]>(() => {
    if (!layout) {
      return [];
    }

    return layout.nodes.map((node) => ({
      id: node.id,
      type: "executionNode",
      position: {
        x: node.x - node.width / 2,
        y: node.y - node.height / 2,
      },
      draggable: false,
      selectable: true,
      selected: selectedNodeId === node.id,
      data: {
        graphNode: node,
        compact,
        isFocused: focusedNodeId === node.id,
        isUpdated: updatedNodeIds.has(node.id) && !reducedMotion,
        onActivate: handleNodeActivate,
        onHover: handleNodeHover,
      },
      style: {
        width: node.width,
        height: node.height,
      },
    }));
  }, [
    layout,
    selectedNodeId,
    compact,
    focusedNodeId,
    updatedNodeIds,
    reducedMotion,
    handleNodeActivate,
    handleNodeHover,
  ]);

  const flowEdges = useMemo<Edge[]>(() => {
    if (!layout) {
      return [];
    }

    const nodeById = new Map(layout.nodes.map((node) => [node.id, node]));

    return layout.edges.map((edge) => {
      const targetNode = nodeById.get(edge.target);
      const highlighted =
        selectedNodeId === edge.source || selectedNodeId === edge.target;
      const color = getEdgeColor(targetNode?.status ?? "pending", highlighted);

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "smoothstep",
        animated: !reducedMotion && Boolean(edge.animated),
        label: edge.label,
        selectable: false,
        style: {
          stroke: color,
          strokeWidth: highlighted ? 2.75 : 2,
          opacity: highlighted ? 1 : 0.7,
        },
        markerEnd: {
          type: "arrowclosed",
          color,
        },
        labelStyle: {
          fill: "#94a3b8",
          fontSize: 10,
        },
      };
    });
  }, [layout, selectedNodeId, reducedMotion]);

  const hasFitOnLoad = useRef(false);

  useEffect(() => {
    hasFitOnLoad.current = false;
  }, [taskId]);

  useEffect(() => {
    if (!flowInstance || !layout || hasFitOnLoad.current) {
      return;
    }

    flowInstance.fitView({
      padding: 0.24,
      duration: 250,
    });

    hasFitOnLoad.current = true;
  }, [flowInstance, layout]);

  const handleZoomIn = useCallback(() => {
    flowInstance?.zoomIn({ duration: 180 });
  }, [flowInstance]);

  const handleZoomOut = useCallback(() => {
    flowInstance?.zoomOut({ duration: 180 });
  }, [flowInstance]);

  const handleFitToView = useCallback(() => {
    flowInstance?.fitView({ padding: 0.24, duration: 220 });
  }, [flowInstance]);

  const handleReset = useCallback(() => {
    flowInstance?.setViewport(
      { x: 0, y: 0, zoom: ZOOM_CONFIG.default },
      { duration: 220 },
    );
  }, [flowInstance]);

  // Loading state
  if (!layout) {
    return (
      <div
        className={`flex items-center justify-center min-h-[400px] ${className}`}
      >
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-sm text-slate-400">Computing graph layout...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (layout.nodes.length === 0) {
    return (
      <div
        className={`flex items-center justify-center min-h-[400px] ${className}`}
      >
        <div className="text-center">
          <svg
            className="h-16 w-16 text-slate-600 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-sm text-slate-400">
            No execution data available yet
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Start task execution to see the graph
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden bg-slate-950 ${className}`}
      role="img"
      aria-label={`Execution graph for task ${taskId} with ${layout.nodes.length} nodes`}
    >
      {enableRealtime && (
        <div className="absolute top-4 left-4 z-20">
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/90 backdrop-blur-sm border ${
              isConnected ? "border-emerald-500/50" : "border-slate-700"
            } text-xs`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-emerald-500 animate-pulse" : "bg-slate-500"
              }`}
            />
            <span className="text-slate-300">
              {isConnected ? "Live" : "Offline"}
            </span>
          </div>
        </div>
      )}

      {layout.nodes.length > 30 && (
        <div
          className="absolute top-4 left-4 z-20"
          style={{ marginTop: enableRealtime ? "48px" : "0" }}
        >
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/90 backdrop-blur-sm border border-slate-700 text-xs">
            <span className="text-slate-400">
              React Flow mode ({layout.nodes.length} nodes)
            </span>
          </div>
        </div>
      )}

      {showControls && (
        <div className="absolute bottom-4 right-4 z-20">
          <GraphControls
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onFitToView={handleFitToView}
            onReset={handleReset}
            currentZoom={currentZoom}
          />
        </div>
      )}

      {showLegend && (
        <div className="absolute top-4 right-4 z-20">
          <GraphLegend />
        </div>
      )}

      {showControls && <GraphKeyboardHelp />}

      <ReactFlow<ExecutionFlowNode>
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={NODE_TYPES}
        fitView
        minZoom={ZOOM_CONFIG.min}
        maxZoom={ZOOM_CONFIG.max}
        defaultViewport={{ x: 0, y: 0, zoom: ZOOM_CONFIG.default }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        panOnScroll
        selectionOnDrag={false}
        onInit={(instance) => setFlowInstance(instance)}
        onMove={(_, viewport) => setCurrentZoom(viewport.zoom)}
        onPaneClick={() => setHoveredNode(null)}
        onNodeClick={(event, node) =>
          handleNodeActivate(node.data.graphNode, event)
        }
        onNodeMouseMove={(event, node) => {
          setHoveredNode(node.data.graphNode);
          setMousePosition({ x: event.clientX, y: event.clientY });
        }}
        onNodeMouseEnter={(event, node) => {
          setHoveredNode(node.data.graphNode);
          setMousePosition({ x: event.clientX, y: event.clientY });
        }}
        onNodeMouseLeave={() => setHoveredNode(null)}
        className="h-full w-full"
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          size={1}
          gap={22}
          color="rgba(51, 65, 85, 0.55)"
        />
        {showMinimap && !compact && (
          <MiniMap
            pannable
            zoomable
            nodeStrokeWidth={2}
            maskColor="rgba(15,23,42,0.65)"
            className="!left-4 !bottom-4 !top-auto !h-[132px] !w-[188px] !rounded-lg !border !border-slate-700 !bg-slate-800/90"
            nodeColor={(node) => {
              const data = node.data as unknown as
                | ExecutionFlowNodeData
                | undefined;
              const status = data?.graphNode.status;
              if (!status) {
                return "#475569";
              }
              return STATUS_MINIMAP_COLORS[status];
            }}
          />
        )}
      </ReactFlow>

      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {selectedNodeId && layout.nodes.find((n) => n.id === selectedNodeId)
          ? `Selected: ${layout.nodes.find((n) => n.id === selectedNodeId)?.label}`
          : ""}
      </div>

      <GraphNodeTooltip
        node={hoveredNode}
        mouseX={mousePosition.x}
        mouseY={mousePosition.y}
        containerRef={containerRef}
      />
    </div>
  );
}
