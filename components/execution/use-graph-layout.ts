"use client";

import { useMemo } from "react";
import dagre from "dagre";
import type {
  ExecutionGraph,
  GraphNode,
  GraphEdge,
  GraphLayoutConfig,
} from "@/lib/shared/graph-types";
import { DEFAULT_LAYOUT_CONFIG } from "@/lib/shared/graph-types";

/**
 * Layout result with positioned nodes and graph dimensions
 */
export interface GraphLayout {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
}

/**
 * Hook options
 */
export interface UseGraphLayoutOptions {
  layoutConfig?: Partial<GraphLayoutConfig>;
}

/**
 * Custom hook for calculating graph layout using Dagre
 */
export function useGraphLayout(
  executionGraph: ExecutionGraph | null | undefined,
  options: UseGraphLayoutOptions = {},
): GraphLayout | null {
  const { layoutConfig = {} } = options;

  return useMemo(() => {
    if (!executionGraph || executionGraph.nodes.length === 0) {
      return null;
    }

    const { nodes, edges } = executionGraph;
    const config = { ...DEFAULT_LAYOUT_CONFIG, ...layoutConfig };

    // Create directed graph
    const g = new dagre.graphlib.Graph();

    // Set graph configuration
    g.setGraph(config);

    // Set default edge configuration
    g.setDefaultEdgeLabel(() => ({}));

    // Add nodes to graph with their dimensions
    for (const node of nodes) {
      g.setNode(node.id, {
        width: node.width,
        height: node.height,
      });
    }

    // Add edges to graph
    for (const edge of edges) {
      g.setEdge(edge.source, edge.target);
    }

    // Calculate layout
    dagre.layout(g);

    // Extract positioned nodes
    const positionedNodes: GraphNode[] = nodes.map((node) => {
      const layoutNode = g.node(node.id);
      return {
        ...node,
        x: layoutNode.x,
        y: layoutNode.y,
      };
    });

    // Calculate graph dimensions (bounding box)
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of positionedNodes) {
      const nodeLeft = node.x - node.width / 2;
      const nodeTop = node.y - node.height / 2;
      const nodeRight = node.x + node.width / 2;
      const nodeBottom = node.y + node.height / 2;

      minX = Math.min(minX, nodeLeft);
      minY = Math.min(minY, nodeTop);
      maxX = Math.max(maxX, nodeRight);
      maxY = Math.max(maxY, nodeBottom);
    }

    const width = maxX - minX + config.marginx * 2;
    const height = maxY - minY + config.marginy * 2;

    // Update edge animations based on node status
    const animatedEdges = edges.map((edge) => {
      const targetNode = positionedNodes.find((n) => n.id === edge.target);
      const sourceNode = positionedNodes.find((n) => n.id === edge.source);

      // Animate edge if target is in-progress and source is complete
      const shouldAnimate =
        targetNode?.status === "in-progress" &&
        (sourceNode?.status === "complete" ||
          sourceNode?.status === "in-progress");

      return {
        ...edge,
        animated: shouldAnimate,
      };
    });

    return {
      nodes: positionedNodes,
      edges: animatedEdges,
      width,
      height,
    };
  }, [executionGraph, layoutConfig]);
}

/**
 * Helper to get edge path (bezier curve) for SVG rendering
 */
export function getEdgePath(
  sourceNode: GraphNode,
  targetNode: GraphNode,
  offset = 0,
): string {
  const sourceX = sourceNode.x + sourceNode.width / 2;
  const sourceY = sourceNode.y;
  const targetX = targetNode.x - targetNode.width / 2;
  const targetY = targetNode.y;

  // Apply offset for parallel edges
  const sourceYOffset = sourceY + offset;
  const targetYOffset = targetY + offset;

  // Calculate control points for bezier curve
  const controlPointOffset = Math.abs(targetX - sourceX) * 0.5;
  const controlX1 = sourceX + controlPointOffset;
  const controlY1 = sourceYOffset;
  const controlX2 = targetX - controlPointOffset;
  const controlY2 = targetYOffset;

  return `M ${sourceX},${sourceYOffset} C ${controlX1},${controlY1} ${controlX2},${controlY2} ${targetX},${targetYOffset}`;
}

/**
 * Calculate edge offset for parallel edges
 */
export function calculateEdgeOffset(
  edges: GraphEdge[],
  currentEdge: GraphEdge,
): number {
  // Find parallel edges (same source and target)
  const parallelEdges = edges.filter(
    (e) =>
      (e.source === currentEdge.source && e.target === currentEdge.target) ||
      (e.source === currentEdge.target && e.target === currentEdge.source),
  );

  if (parallelEdges.length <= 1) return 0;

  // Calculate offset based on index
  const index = parallelEdges.findIndex((e) => e.id === currentEdge.id);
  const totalOffset = (parallelEdges.length - 1) * 20;
  const startOffset = -totalOffset / 2;

  return startOffset + index * 20;
}
