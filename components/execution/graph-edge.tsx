"use client";

import React from "react";
import type { GraphEdge, GraphNode } from "@/lib/shared/graph-types";
import { ANIMATION_DURATIONS } from "@/lib/shared/graph-types";

/**
 * Props for GraphEdge component
 */
export interface GraphEdgeComponentProps {
  edge: GraphEdge;
  sourceNode: GraphNode;
  targetNode: GraphNode;
  isHighlighted: boolean;
  offset?: number;
}

/**
 * Status-based edge colors
 */
const getEdgeColor = (targetStatus: string, isHighlighted: boolean): string => {
  if (isHighlighted) {
    return "rgb(16 185 129)"; // emerald-500
  }

  switch (targetStatus) {
    case "pending":
      return "rgb(71 85 105)"; // slate-600
    case "in-progress":
      return "rgb(59 130 246)"; // blue-500
    case "complete":
      return "rgb(16 185 129)"; // emerald-500
    case "failed":
    case "stuck":
      return "rgb(239 68 68)"; // red-500
    default:
      return "rgb(71 85 105)"; // slate-600
  }
};

/**
 * Calculate bezier curve path for edge
 */
function calculatePath(
  sourceNode: GraphNode,
  targetNode: GraphNode,
  offset = 0,
): string {
  // Start from right center of source node
  const sourceX = sourceNode.x + sourceNode.width / 2;
  const sourceY = sourceNode.y + offset;

  // End at left center of target node
  const targetX = targetNode.x - targetNode.width / 2;
  const targetY = targetNode.y + offset;

  // Calculate control points for smooth bezier curve
  const controlPointOffset = Math.abs(targetX - sourceX) * 0.5;
  const controlX1 = sourceX + controlPointOffset;
  const controlY1 = sourceY;
  const controlX2 = targetX - controlPointOffset;
  const controlY2 = targetY;

  return `M ${sourceX},${sourceY} C ${controlX1},${controlY1} ${controlX2},${controlY2} ${targetX},${targetY}`;
}

/**
 * Graph edge component - renders connections between nodes
 */
export const GraphEdgeComponent = React.memo(function GraphEdgeComponent({
  edge,
  sourceNode,
  targetNode,
  isHighlighted,
  offset = 0,
}: GraphEdgeComponentProps) {
  const path = calculatePath(sourceNode, targetNode, offset);
  const color = getEdgeColor(targetNode.status, isHighlighted);
  const strokeWidth = isHighlighted ? 3 : 2;
  const isAnimated = edge.animated || false;

  return (
    <g
      className="graph-edge"
      aria-label={`Connection from ${sourceNode.label} to ${targetNode.label}`}
      style={{
        transition: `all ${ANIMATION_DURATIONS.statusTransition}ms ease-in-out`,
      }}
    >
      {/* Main edge path */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={isAnimated ? "8 4" : "none"}
        opacity={isHighlighted ? 1 : 0.6}
        style={{
          transition: `all ${ANIMATION_DURATIONS.statusTransition}ms ease-in-out`,
        }}
      >
        {/* Animated dash offset for in-progress edges */}
        {isAnimated && (
          <animate
            attributeName="stroke-dashoffset"
            from="0"
            to="-12"
            dur={`${ANIMATION_DURATIONS.flowAnimation}ms`}
            repeatCount="indefinite"
          />
        )}
      </path>

      {/* Arrow marker */}
      <defs>
        <marker
          id={`arrow-${edge.id}`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path
            d="M 0 0 L 10 5 L 0 10 z"
            fill={color}
            opacity={isHighlighted ? 1 : 0.6}
          />
        </marker>
      </defs>

      {/* Apply arrow marker to path */}
      <path
        d={path}
        fill="none"
        stroke="none"
        markerEnd={`url(#arrow-${edge.id})`}
      />

      {/* Flow indicator (moving circle for active edges) */}
      {isAnimated && (
        <>
          <circle r="3" fill={color}>
            <animateMotion
              dur={`${ANIMATION_DURATIONS.flowAnimation}ms`}
              repeatCount="indefinite"
            >
              <mpath href={`#path-${edge.id}`} />
            </animateMotion>
          </circle>
          <path id={`path-${edge.id}`} d={path} fill="none" stroke="none" />
        </>
      )}

      {/* Edge label (if provided) */}
      {edge.label && (
        <text
          className="edge-label"
          fill="rgb(148 163 184)"
          fontSize="10"
          textAnchor="middle"
        >
          <textPath
            href={`#path-${edge.id}`}
            startOffset="50%"
            className="select-none"
          >
            {edge.label}
          </textPath>
        </text>
      )}
    </g>
  );
});
