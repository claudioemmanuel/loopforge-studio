"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useDependencyHighlight } from "./dependency-highlight-context";
import type { Task, TaskStatus } from "@/lib/db/schema";
import {
  calculateRoutedPath,
  groupConnectionsByTarget,
  type Rect,
  type Point,
} from "@/lib/utils/dependency-routing";

interface DependencyLinesProps {
  tasks: Task[];
  containerRef: React.RefObject<HTMLElement>;
}

interface Connection {
  fromId: string;
  toId: string;
  fromPos: Point;
  toPos: Point;
  fromRect: Rect;
  toRect: Rect;
  path: string;
  isBackward: boolean;
  blockedTaskStatus: TaskStatus;
}

// Status colors matching the blocked card's status
const statusColors: Record<TaskStatus, string> = {
  todo: "rgb(100, 116, 139)", // slate-500
  brainstorming: "rgb(139, 92, 246)", // violet-500
  planning: "rgb(59, 130, 246)", // blue-500
  ready: "rgb(245, 158, 11)", // amber-500
  executing: "rgb(34, 197, 94)", // emerald-500
  review: "rgb(6, 182, 212)", // cyan-500
  done: "rgb(16, 185, 129)", // emerald-500
  stuck: "rgb(239, 68, 68)", // red-500
};

export function DependencyLines({ tasks, containerRef }: DependencyLinesProps) {
  const { hoveredTaskId, dependencyChainIds, hasConnections } =
    useDependencyHighlight();
  const [connections, setConnections] = useState<Connection[]>([]);
  const rafRef = useRef<number | null>(null);

  const updateConnections = useCallback(() => {
    // Only render when there's a hovered task with connections
    if (!containerRef.current || !hoveredTaskId || !hasConnections) {
      setConnections([]);
      return;
    }

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft;
    const scrollTop = container.scrollTop;

    // Create a set for quick lookup of tasks in the chain
    const chainIdSet = new Set(dependencyChainIds);

    // Filter tasks to only those in the dependency chain
    const chainTasks = tasks.filter((t) => chainIdSet.has(t.id));

    // Collect all card rectangles for obstacle detection
    const cardElements = container.querySelectorAll("[data-task-id]");
    const allCardRects: { id: string; rect: Rect }[] = [];
    cardElements.forEach((el) => {
      const domRect = el.getBoundingClientRect();
      const id = el.getAttribute("data-task-id");
      if (id) {
        allCardRects.push({
          id,
          rect: {
            left: domRect.left - containerRect.left + scrollLeft,
            right: domRect.right - containerRect.left + scrollLeft,
            top: domRect.top - containerRect.top + scrollTop,
            bottom: domRect.bottom - containerRect.top + scrollTop,
          },
        });
      }
    });

    // First pass: collect raw connection data (only for tasks in the chain)
    const rawConnections: {
      fromId: string;
      toId: string;
      fromPos: Point;
      toPos: Point;
      fromRect: Rect;
      toRect: Rect;
      blockedTaskStatus: TaskStatus;
    }[] = [];

    chainTasks.forEach((task) => {
      const blockedBy = (task.blockedByIds as string[]) || [];
      if (blockedBy.length === 0) return;

      const toElement = container.querySelector(`[data-task-id="${task.id}"]`);
      if (!toElement) return;

      const toCardData = allCardRects.find((c) => c.id === task.id);
      if (!toCardData) return;

      const toRect = toCardData.rect;
      const toPos = {
        x: toRect.left,
        y: toRect.top + (toRect.bottom - toRect.top) / 2,
      };

      blockedBy.forEach((blockerId) => {
        // Only include connections where the blocker is also in the chain
        if (!chainIdSet.has(blockerId)) return;

        const fromCardData = allCardRects.find((c) => c.id === blockerId);
        if (!fromCardData) return;

        const fromRect = fromCardData.rect;
        const fromPos = {
          x: fromRect.right,
          y: fromRect.top + (fromRect.bottom - fromRect.top) / 2,
        };

        rawConnections.push({
          fromId: blockerId,
          toId: task.id,
          fromPos,
          toPos,
          fromRect,
          toRect,
          blockedTaskStatus: task.status,
        });
      });
    });

    // Group connections by target to calculate offsets for parallel lines
    const connectionsByTarget = groupConnectionsByTarget(rawConnections);

    // Second pass: calculate routed paths with offsets
    const newConnections: Connection[] = [];
    const allRects = allCardRects.map((c) => c.rect);

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
        ...conn,
        path,
        isBackward,
      });
    });

    setConnections(newConnections);
  }, [tasks, containerRef, hoveredTaskId, dependencyChainIds, hasConnections]);

  // Update connections on mount, scroll, and resize
  useEffect(() => {
    // Only set up listeners when there's a hovered task with connections
    if (!hoveredTaskId || !hasConnections) {
      setConnections([]);
      return;
    }

    const update = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(updateConnections);
    };

    update();

    const container = containerRef.current;
    if (container) {
      container.addEventListener("scroll", update);
    }

    window.addEventListener("resize", update);

    // Also update when hoveredTaskId changes
    const observer = new MutationObserver(update);
    if (container) {
      observer.observe(container, { childList: true, subtree: true });
    }

    return () => {
      if (container) {
        container.removeEventListener("scroll", update);
      }
      window.removeEventListener("resize", update);
      observer.disconnect();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [hoveredTaskId, hasConnections, updateConnections, containerRef]);

  // Update on hover change
  useEffect(() => {
    updateConnections();
  }, [hoveredTaskId, updateConnections]);

  // Don't render if no hovered task, no connections, or no rendered connections
  if (!hoveredTaskId || !hasConnections || connections.length === 0) {
    return null;
  }

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-10"
      style={{ overflow: "visible" }}
    >
      <defs>
        {/* Generate unique markers for each status color */}
        {(Object.keys(statusColors) as TaskStatus[]).map((status) => (
          <marker
            key={`arrowhead-${status}`}
            id={`arrowhead-${status}`}
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill={statusColors[status]}
              fillOpacity="0.9"
            />
          </marker>
        ))}
      </defs>

      {connections.map((conn) => {
        const strokeColor = statusColors[conn.blockedTaskStatus];

        return (
          <path
            key={`${conn.fromId}-${conn.toId}`}
            d={conn.path}
            fill="none"
            stroke={strokeColor}
            strokeWidth={2}
            strokeDasharray="6 6"
            markerEnd={`url(#arrowhead-${conn.blockedTaskStatus})`}
            className="transition-all duration-200"
            style={{
              opacity: 0.8,
            }}
          />
        );
      })}
    </svg>
  );
}
