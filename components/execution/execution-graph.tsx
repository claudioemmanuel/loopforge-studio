"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import type { ExecutionGraph, GraphNode } from "@/lib/shared/graph-types";
import { useGraphLayout } from "./use-graph-layout";
import { useGraphViewport } from "./use-graph-viewport";
import { GraphNodeComponent } from "./graph-node";
import { GraphEdgeComponent } from "./graph-edge";
import { GraphControls } from "./graph-controls";
import { GraphMinimap } from "./graph-minimap";
import { GraphLegend } from "./graph-legend";
import { GraphNodeTooltip } from "./graph-node-tooltip";
import { useGraphRealtime } from "./use-graph-realtime";
import { useGraphKeyboard } from "./use-graph-keyboard";
import { GraphAnnouncer, prefersReducedMotion } from "./graph-accessibility";
import { GraphKeyboardHelp } from "./graph-keyboard-help";
import {
  getViewportBounds,
  getVisibleNodes,
  getVisibleEdges,
  shouldUseCanvasRendering,
} from "./graph-performance";

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
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Calculate layout
  const layout = useGraphLayout(executionGraph);

  // Viewport management
  const { viewport, pan, zoomIn, zoomOut, fitToView, reset, setViewport } =
    useGraphViewport(containerRef);

  // Real-time updates via SSE
  const { isConnected, updatedNodeIds } = useGraphRealtime({
    taskId,
    executionGraph,
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

  // Initialize announcer
  useEffect(() => {
    announcerRef.current = new GraphAnnouncer();
    return () => {
      announcerRef.current?.destroy();
    };
  }, []);

  // Announce connection status changes
  useEffect(() => {
    if (enableRealtime) {
      announcerRef.current?.announceConnectionStatus(isConnected);
    }
  }, [isConnected, enableRealtime]);

  // Check for reduced motion preference
  const reducedMotion = prefersReducedMotion();

  // Performance: viewport culling for large graphs
  const useCanvasMode = layout
    ? shouldUseCanvasRendering(layout.nodes.length)
    : false;

  // Calculate visible nodes/edges based on viewport
  const visibleContent = React.useMemo(() => {
    if (!layout || useCanvasMode) {
      return { nodes: layout?.nodes || [], edges: layout?.edges || [] };
    }

    const bounds = getViewportBounds(
      viewport,
      containerDimensions.width,
      containerDimensions.height,
    );

    const visibleNodes = getVisibleNodes(layout.nodes, bounds);
    const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
    const visibleEdges = getVisibleEdges(
      layout.edges,
      layout.nodes,
      visibleNodeIds,
    );

    return { nodes: visibleNodes, edges: visibleEdges };
  }, [layout, viewport, containerDimensions, useCanvasMode]);

  // Get container dimensions for minimap
  const [containerDimensions, setContainerDimensions] = useState({
    width: 800,
    height: 600,
  });

  useEffect(() => {
    if (containerRef.current) {
      const updateDimensions = () => {
        setContainerDimensions({
          width: containerRef.current?.clientWidth || 800,
          height: containerRef.current?.clientHeight || 600,
        });
      };

      updateDimensions();
      window.addEventListener("resize", updateDimensions);
      return () => window.removeEventListener("resize", updateDimensions);
    }
  }, []);

  // Handle node click
  const handleNodeClick = useCallback(
    (node: GraphNode, e: React.MouseEvent) => {
      setSelectedNodeId(node.id);
      setHoveredNode(node);
      setMousePosition({ x: e.clientX, y: e.clientY });
      onNodeClick?.(node);
    },
    [onNodeClick],
  );

  // Handle node hover
  const handleNodeHover = useCallback(
    (node: GraphNode | null, e?: React.MouseEvent) => {
      setHoveredNode(node);
      if (e) {
        setMousePosition({ x: e.clientX, y: e.clientY });
      }
    },
    [],
  );

  // Handle fit to view with dimensions
  const handleFitToView = useCallback(() => {
    if (layout && containerRef.current) {
      fitToView({
        width: layout.width,
        height: layout.height,
        containerWidth: containerDimensions.width,
        containerHeight: containerDimensions.height,
      });
    }
  }, [layout, fitToView, containerDimensions]);

  // Handle viewport change from minimap
  const handleViewportChange = useCallback(
    (x: number, y: number) => {
      setViewport({ x, y });
    },
    [setViewport],
  );

  // Mouse pan handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      // Only pan with left mouse button and no modifier keys
      if (e.button === 0 && !e.ctrlKey && !e.metaKey) {
        setIsPanning(true);
        setPanStart({ x: e.clientX - viewport.x, y: e.clientY - viewport.y });
        e.preventDefault();
      }
    },
    [viewport.x, viewport.y],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (isPanning) {
        const dx = e.clientX - panStart.x - viewport.x;
        const dy = e.clientY - panStart.y - viewport.y;
        pan(dx, dy);
      } else if (hoveredNode) {
        setMousePosition({ x: e.clientX, y: e.clientY });
      }
    },
    [isPanning, panStart, viewport.x, viewport.y, pan, hoveredNode],
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Touch pan handlers
  const handleTouchStart = useCallback(
    (e: React.TouchEvent<SVGSVGElement>) => {
      if (e.touches.length === 1) {
        setIsPanning(true);
        setPanStart({
          x: e.touches[0].clientX - viewport.x,
          y: e.touches[0].clientY - viewport.y,
        });
      }
    },
    [viewport.x, viewport.y],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<SVGSVGElement>) => {
      if (isPanning && e.touches.length === 1) {
        const dx = e.touches[0].clientX - panStart.x - viewport.x;
        const dy = e.touches[0].clientY - panStart.y - viewport.y;
        pan(dx, dy);
        e.preventDefault();
      }
    },
    [isPanning, panStart, viewport.x, viewport.y, pan],
  );

  const handleTouchEnd = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Fit to view on initial load
  useEffect(() => {
    if (layout && containerDimensions.width && containerDimensions.height) {
      handleFitToView();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

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

  // Calculate viewBox
  const viewBoxX = -viewport.x / viewport.zoom;
  const viewBoxY = -viewport.y / viewport.zoom;
  const viewBoxWidth =
    (containerRef.current?.clientWidth || 800) / viewport.zoom;
  const viewBoxHeight =
    (containerRef.current?.clientHeight || 600) / viewport.zoom;

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden bg-slate-950 ${className}`}
      role="img"
      aria-label={`Execution graph for task ${taskId} with ${layout.nodes.length} nodes`}
    >
      {/* Real-time connection indicator */}
      {enableRealtime && (
        <div className="absolute top-4 left-4 z-10">
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

      {/* Performance indicator for large graphs */}
      {layout && layout.nodes.length > 30 && (
        <div
          className="absolute top-4 left-4 z-10"
          style={{ marginTop: enableRealtime ? "48px" : "0" }}
        >
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/90 backdrop-blur-sm border border-slate-700 text-xs">
            <span className="text-slate-400">
              {useCanvasMode
                ? `Canvas mode (${layout.nodes.length} nodes)`
                : `Rendering ${visibleContent.nodes.length}/${layout.nodes.length} nodes`}
            </span>
          </div>
        </div>
      )}

      {/* Graph Controls */}
      {showControls && (
        <div className="absolute bottom-4 right-4 z-10">
          <GraphControls
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onFitToView={handleFitToView}
            onReset={reset}
            currentZoom={viewport.zoom}
          />
        </div>
      )}

      {/* Graph Minimap */}
      {showMinimap && !compact && layout && (
        <div className="absolute bottom-4 left-4 z-10 hidden md:block">
          <GraphMinimap
            nodes={layout.nodes}
            edges={layout.edges}
            graphWidth={layout.width}
            graphHeight={layout.height}
            viewport={viewport}
            containerWidth={containerDimensions.width}
            containerHeight={containerDimensions.height}
            onViewportChange={handleViewportChange}
          />
        </div>
      )}

      {/* Graph Legend */}
      {showLegend && (
        <div className="absolute top-4 right-4 z-10">
          <GraphLegend />
        </div>
      )}

      {/* Keyboard shortcuts help */}
      {showControls && <GraphKeyboardHelp />}

      <svg
        ref={svgRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Grid pattern for background */}
        <defs>
          <pattern
            id="grid"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="rgb(30 41 59 / 0.4)"
              strokeWidth="1"
            />
          </pattern>
        </defs>

        <rect
          x={viewBoxX}
          y={viewBoxY}
          width={viewBoxWidth}
          height={viewBoxHeight}
          fill="url(#grid)"
        />

        {/* Render edges first (behind nodes) */}
        <g className="edges" aria-hidden="true">
          {visibleContent.edges.map((edge) => {
            const sourceNode = layout.nodes.find((n) => n.id === edge.source);
            const targetNode = layout.nodes.find((n) => n.id === edge.target);

            if (!sourceNode || !targetNode) return null;

            return (
              <GraphEdgeComponent
                key={edge.id}
                edge={edge}
                sourceNode={sourceNode}
                targetNode={targetNode}
                isHighlighted={
                  selectedNodeId === edge.source ||
                  selectedNodeId === edge.target
                }
              />
            );
          })}
        </g>

        {/* Render nodes */}
        <g className="nodes">
          {visibleContent.nodes.map((node) => {
            const index = layout.nodes.findIndex((n) => n.id === node.id);
            return (
              <GraphNodeComponent
                key={node.id}
                node={node}
                onClick={handleNodeClick}
                onHover={handleNodeHover}
                isSelected={
                  selectedNodeId === node.id || focusedNodeIndex === index
                }
                isUpdated={updatedNodeIds.has(node.id) && !reducedMotion}
                compact={compact}
              />
            );
          })}
        </g>
      </svg>

      {/* Live region for status updates (screen reader) */}
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

      {/* Tooltip for node details */}
      <GraphNodeTooltip
        node={hoveredNode}
        mouseX={mousePosition.x}
        mouseY={mousePosition.y}
        containerRef={containerRef}
      />
    </div>
  );
}
