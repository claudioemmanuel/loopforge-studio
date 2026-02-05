"use client";

import React, { useRef, useCallback } from "react";
import type { GraphNode, GraphEdge } from "@/lib/shared/graph-types";
import type { ViewportState } from "./use-graph-viewport";

/**
 * Props for GraphMinimap component
 */
export interface GraphMinimapProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  graphWidth: number;
  graphHeight: number;
  viewport: ViewportState;
  containerWidth: number;
  containerHeight: number;
  onViewportChange: (x: number, y: number) => void;
  className?: string;
}

const MINIMAP_WIDTH = 200;
const MINIMAP_HEIGHT = 150;

/**
 * Graph minimap component - shows overview of entire graph with viewport indicator
 */
export function GraphMinimap({
  nodes,
  edges,
  graphWidth,
  graphHeight,
  viewport,
  containerWidth,
  containerHeight,
  onViewportChange,
  className = "",
}: GraphMinimapProps) {
  const minimapRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  // Calculate scale to fit entire graph in minimap
  const scaleX = MINIMAP_WIDTH / graphWidth;
  const scaleY = MINIMAP_HEIGHT / graphHeight;
  const scale = Math.min(scaleX, scaleY);

  // Calculate viewport rectangle dimensions in minimap space
  const viewportWidth = (containerWidth / viewport.zoom) * scale;
  const viewportHeight = (containerHeight / viewport.zoom) * scale;
  const viewportX = (-viewport.x / viewport.zoom) * scale;
  const viewportY = (-viewport.y / viewport.zoom) * scale;

  // Handle click/drag on minimap
  const handleMinimapInteraction = useCallback(
    (clientX: number, clientY: number) => {
      if (!minimapRef.current) return;

      const rect = minimapRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      // Convert minimap coordinates to graph coordinates
      const graphX = (x / scale) * viewport.zoom;
      const graphY = (y / scale) * viewport.zoom;

      // Center viewport at clicked position
      const newX = -graphX + containerWidth / 2;
      const newY = -graphY + containerHeight / 2;

      onViewportChange(newX, newY);
    },
    [scale, viewport.zoom, containerWidth, containerHeight, onViewportChange],
  );

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    setIsDragging(true);
    handleMinimapInteraction(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging) {
      handleMinimapInteraction(e.clientX, e.clientY);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent<SVGSVGElement>) => {
    setIsDragging(true);
    if (e.touches.length > 0) {
      handleMinimapInteraction(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (isDragging && e.touches.length > 0) {
      handleMinimapInteraction(e.touches[0].clientX, e.touches[0].clientY);
      e.preventDefault();
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Status color mapping for minimap nodes
  const getNodeColor = (status: string): string => {
    switch (status) {
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
        return "rgb(71 85 105)";
    }
  };

  return (
    <div
      className={`bg-slate-800/90 backdrop-blur-sm rounded-lg border border-slate-700 shadow-lg p-2 ${className}`}
    >
      <div className="text-xs text-slate-400 font-medium mb-2">Overview</div>
      <svg
        ref={minimapRef}
        width={MINIMAP_WIDTH}
        height={MINIMAP_HEIGHT}
        viewBox={`0 0 ${MINIMAP_WIDTH} ${MINIMAP_HEIGHT}`}
        className="cursor-pointer bg-slate-900/50 rounded"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        role="img"
        aria-label="Graph overview minimap"
      >
        {/* Background */}
        <rect
          x={0}
          y={0}
          width={MINIMAP_WIDTH}
          height={MINIMAP_HEIGHT}
          fill="rgb(15 23 42)"
        />

        {/* Graph edges (simplified lines) */}
        {edges.map((edge) => {
          const sourceNode = nodes.find((n) => n.id === edge.source);
          const targetNode = nodes.find((n) => n.id === edge.target);

          if (!sourceNode || !targetNode) return null;

          const x1 = sourceNode.x * scale;
          const y1 = sourceNode.y * scale;
          const x2 = targetNode.x * scale;
          const y2 = targetNode.y * scale;

          return (
            <line
              key={edge.id}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="rgb(71 85 105)"
              strokeWidth={1}
              opacity={0.3}
            />
          );
        })}

        {/* Graph nodes (small rectangles) */}
        {nodes.map((node) => {
          const x = node.x * scale - (node.width * scale) / 2;
          const y = node.y * scale - (node.height * scale) / 2;
          const width = node.width * scale;
          const height = node.height * scale;

          return (
            <rect
              key={node.id}
              x={x}
              y={y}
              width={width}
              height={height}
              fill={getNodeColor(node.status)}
              stroke="none"
              opacity={0.8}
              rx={2}
            />
          );
        })}

        {/* Viewport indicator rectangle */}
        <rect
          x={viewportX}
          y={viewportY}
          width={viewportWidth}
          height={viewportHeight}
          fill="none"
          stroke="rgb(16 185 129)"
          strokeWidth={2}
          strokeDasharray="4 2"
          opacity={0.8}
          rx={2}
          pointerEvents="none"
        >
          {/* Animated dash for visibility */}
          <animate
            attributeName="stroke-dashoffset"
            from="0"
            to="-6"
            dur="1s"
            repeatCount="indefinite"
          />
        </rect>

        {/* Viewport fill (semi-transparent) */}
        <rect
          x={viewportX}
          y={viewportY}
          width={viewportWidth}
          height={viewportHeight}
          fill="rgb(16 185 129)"
          opacity={0.1}
          rx={2}
          pointerEvents="none"
        />
      </svg>
    </div>
  );
}
