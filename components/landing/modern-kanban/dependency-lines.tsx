"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  calculateRoutedPath,
  groupConnectionsByTarget,
  type Rect,
  type Point,
} from "@/lib/utils/dependency-routing";
import type { DemoCard } from "./demo-data";

// ============================================================================
// Dependency Lines Component
// ============================================================================

export interface DependencyLinesProps {
  cards: DemoCard[];
  containerRef: React.RefObject<HTMLDivElement>;
  highlightedConnection?: {
    from: string;
    to: string;
    state: "active" | "unlocking" | "hidden";
  };
}

export function DependencyLines({
  cards,
  containerRef,
  highlightedConnection,
}: DependencyLinesProps) {
  const shouldReduceMotion = useReducedMotion();
  const [connections, setConnections] = useState<
    Array<{
      fromId: string;
      toId: string;
      path: string;
      state: "active" | "unlocking" | "hidden";
      isBackward: boolean;
    }>
  >([]);

  const updateConnections = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();

    // Collect all card rectangles for obstacle detection
    const cardElements = container.querySelectorAll("[data-card-id]");
    const allCardRects: { id: string; rect: Rect }[] = [];
    cardElements.forEach((el) => {
      const domRect = el.getBoundingClientRect();
      const id = el.getAttribute("data-card-id");
      if (id) {
        allCardRects.push({
          id,
          rect: {
            left: domRect.left - containerRect.left,
            right: domRect.right - containerRect.left,
            top: domRect.top - containerRect.top,
            bottom: domRect.bottom - containerRect.top,
          },
        });
      }
    });

    // First pass: collect raw connection data
    const rawConnections: {
      fromId: string;
      toId: string;
      fromPos: Point;
      toPos: Point;
      fromRect: Rect;
      toRect: Rect;
      state: "active" | "unlocking" | "hidden";
    }[] = [];

    cards.forEach((card) => {
      if (card.blockedByIds.length === 0) return;

      const toCardData = allCardRects.find((c) => c.id === card.id);
      if (!toCardData) return;

      card.blockedByIds.forEach((blockerId) => {
        const fromCardData = allCardRects.find((c) => c.id === blockerId);
        if (!fromCardData) return;

        const fromRect = fromCardData.rect;
        const toRect = toCardData.rect;

        const fromPos = {
          x: fromRect.right,
          y: fromRect.top + (fromRect.bottom - fromRect.top) / 2,
        };
        const toPos = {
          x: toRect.left,
          y: toRect.top + (toRect.bottom - toRect.top) / 2,
        };

        let state: "active" | "unlocking" | "hidden" = "active";
        if (
          highlightedConnection &&
          highlightedConnection.from === blockerId &&
          highlightedConnection.to === card.id
        ) {
          state = highlightedConnection.state;
        }

        rawConnections.push({
          fromId: blockerId,
          toId: card.id,
          fromPos,
          toPos,
          fromRect,
          toRect,
          state,
        });
      });
    });

    // Group connections by target to calculate offsets for parallel lines
    const connectionsByTarget = groupConnectionsByTarget(rawConnections);

    // Second pass: calculate routed paths with offsets
    const allRects = allCardRects.map((c) => c.rect);
    const newConnections: typeof connections = [];

    rawConnections.forEach((conn) => {
      const targetGroup = connectionsByTarget.get(conn.toId) || [];
      const lineIndex = targetGroup.indexOf(conn);
      const totalLines = targetGroup.length;

      const { path, isBackward } = calculateRoutedPath(
        {
          from: conn.fromPos,
          to: conn.toPos,
          fromRect: conn.fromRect,
          toRect: conn.toRect,
        },
        allRects,
        lineIndex,
        totalLines,
      );

      newConnections.push({
        fromId: conn.fromId,
        toId: conn.toId,
        path,
        state: conn.state,
        isBackward,
      });
    });

    setConnections(newConnections);
  }, [cards, containerRef, highlightedConnection]);

  useEffect(() => {
    updateConnections();
    window.addEventListener("resize", updateConnections);
    return () => window.removeEventListener("resize", updateConnections);
  }, [updateConnections]);

  // Re-render when cards update (for position changes)
  useEffect(() => {
    const timer = setTimeout(updateConnections, 100);
    return () => clearTimeout(timer);
  }, [cards, updateConnections]);

  if (shouldReduceMotion || connections.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-20"
      style={{ overflow: "visible" }}
    >
      <defs>
        {/* Forward active gradient (amber to red) */}
        <linearGradient
          id="dep-gradient-active"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="0%"
        >
          <stop offset="0%" stopColor="rgb(251, 191, 36)" stopOpacity="0.7" />
          <stop offset="100%" stopColor="rgb(239, 68, 68)" stopOpacity="0.7" />
        </linearGradient>
        {/* Unlocking gradient (green) */}
        <linearGradient
          id="dep-gradient-unlock"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="0%"
        >
          <stop offset="0%" stopColor="rgb(34, 197, 94)" stopOpacity="0.8" />
          <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity="0.8" />
        </linearGradient>
        {/* Backward gradient (subtle slate) */}
        <linearGradient
          id="dep-gradient-backward"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="0%"
        >
          <stop offset="0%" stopColor="rgb(100, 116, 139)" stopOpacity="0.25" />
          <stop
            offset="100%"
            stopColor="rgb(100, 116, 139)"
            stopOpacity="0.25"
          />
        </linearGradient>
        {/* Arrow markers */}
        <marker
          id="arrowhead-active"
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
          orient="auto"
        >
          <polygon
            points="0 0, 8 3, 0 6"
            fill="rgb(239, 68, 68)"
            fillOpacity="0.7"
          />
        </marker>
        <marker
          id="arrowhead-unlock"
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
          orient="auto"
        >
          <polygon
            points="0 0, 8 3, 0 6"
            fill="rgb(16, 185, 129)"
            fillOpacity="0.8"
          />
        </marker>
        <marker
          id="arrowhead-backward"
          markerWidth="6"
          markerHeight="5"
          refX="5"
          refY="2.5"
          orient="auto"
        >
          <polygon
            points="0 0, 6 2.5, 0 5"
            fill="rgb(100, 116, 139)"
            fillOpacity="0.3"
          />
        </marker>
      </defs>

      {connections.map((conn) => {
        if (conn.state === "hidden") return null;

        const isUnlocking = conn.state === "unlocking";

        // Determine styling based on direction and state
        const getStroke = () => {
          if (isUnlocking) return "url(#dep-gradient-unlock)";
          if (conn.isBackward) return "url(#dep-gradient-backward)";
          return "url(#dep-gradient-active)";
        };

        const getStrokeWidth = () => {
          if (isUnlocking) return 2;
          if (conn.isBackward) return 1;
          return 1.5;
        };

        const getDashArray = () => {
          if (isUnlocking) return "none";
          if (conn.isBackward) return "2 3";
          return "4 4";
        };

        const getMarkerEnd = () => {
          if (isUnlocking) return "url(#arrowhead-unlock)";
          if (conn.isBackward) return "url(#arrowhead-backward)";
          return "url(#arrowhead-active)";
        };

        return (
          <motion.path
            key={`${conn.fromId}-${conn.toId}`}
            d={conn.path}
            fill="none"
            stroke={getStroke()}
            strokeWidth={getStrokeWidth()}
            strokeDasharray={getDashArray()}
            markerEnd={getMarkerEnd()}
            initial={{ opacity: 0, pathLength: 0 }}
            animate={{
              opacity: isUnlocking ? [1, 0] : conn.isBackward ? 0.4 : 0.6,
              pathLength: 1,
            }}
            transition={{
              opacity: isUnlocking
                ? { duration: 1.5, ease: "easeOut" }
                : { duration: 0.3 },
              pathLength: { duration: 0.5, ease: "easeOut" },
            }}
          />
        );
      })}
    </svg>
  );
}
