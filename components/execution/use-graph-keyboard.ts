"use client";

import { useEffect, useCallback, useState } from "react";
import type { GraphNode } from "@/lib/shared/graph-types";

/**
 * Hook options
 */
interface UseGraphKeyboardOptions {
  nodes: GraphNode[];
  onNodeSelect?: (node: GraphNode) => void;
  enabled?: boolean;
}

/**
 * Hook return type
 */
interface UseGraphKeyboardReturn {
  focusedNodeIndex: number;
  focusedNode: GraphNode | null;
  setFocusedNodeIndex: (index: number) => void;
}

/**
 * Custom hook for keyboard navigation in graph
 */
export function useGraphKeyboard({
  nodes,
  onNodeSelect,
  enabled = true,
}: UseGraphKeyboardOptions): UseGraphKeyboardReturn {
  const [focusedNodeIndex, setFocusedNodeIndex] = useState(0);

  const focusedNode = nodes[focusedNodeIndex] || null;

  // Navigate to next node
  const focusNext = useCallback(() => {
    setFocusedNodeIndex((prev) => {
      const next = (prev + 1) % nodes.length;
      if (nodes[next]) {
        onNodeSelect?.(nodes[next]);
      }
      return next;
    });
  }, [nodes, onNodeSelect]);

  // Navigate to previous node
  const focusPrevious = useCallback(() => {
    setFocusedNodeIndex((prev) => {
      const next = prev === 0 ? nodes.length - 1 : prev - 1;
      if (nodes[next]) {
        onNodeSelect?.(nodes[next]);
      }
      return next;
    });
  }, [nodes, onNodeSelect]);

  // Navigate by position (arrow keys)
  const navigateByPosition = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      if (!focusedNode || nodes.length === 0) return;

      const currentNode = focusedNode;
      let closestNode: GraphNode | null = null;
      let closestDistance = Infinity;

      nodes.forEach((node) => {
        if (node.id === currentNode.id) return;

        const dx = node.x - currentNode.x;
        const dy = node.y - currentNode.y;

        // Check if node is in the desired direction
        let isInDirection = false;
        let relevantDistance = 0;

        switch (direction) {
          case "right":
            isInDirection = dx > 20; // At least 20px to the right
            relevantDistance = Math.abs(dx) + Math.abs(dy) * 0.5; // Prefer horizontal movement
            break;
          case "left":
            isInDirection = dx < -20;
            relevantDistance = Math.abs(dx) + Math.abs(dy) * 0.5;
            break;
          case "down":
            isInDirection = dy > 20;
            relevantDistance = Math.abs(dy) + Math.abs(dx) * 0.5; // Prefer vertical movement
            break;
          case "up":
            isInDirection = dy < -20;
            relevantDistance = Math.abs(dy) + Math.abs(dx) * 0.5;
            break;
        }

        if (isInDirection && relevantDistance < closestDistance) {
          closestDistance = relevantDistance;
          closestNode = node;
        }
      });

      if (closestNode) {
        const newIndex = nodes.findIndex((n) => n.id === closestNode?.id);
        if (newIndex !== -1) {
          setFocusedNodeIndex(newIndex);
          onNodeSelect?.(closestNode);
        }
      }
    },
    [nodes, focusedNode, onNodeSelect],
  );

  // Keyboard event handler
  useEffect(() => {
    if (!enabled || nodes.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case "Tab":
          e.preventDefault();
          if (e.shiftKey) {
            focusPrevious();
          } else {
            focusNext();
          }
          break;

        case "ArrowRight":
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            navigateByPosition("right");
          }
          break;

        case "ArrowLeft":
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            navigateByPosition("left");
          }
          break;

        case "ArrowDown":
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            navigateByPosition("down");
          }
          break;

        case "ArrowUp":
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            navigateByPosition("up");
          }
          break;

        case "Home":
          e.preventDefault();
          setFocusedNodeIndex(0);
          if (nodes[0]) {
            onNodeSelect?.(nodes[0]);
          }
          break;

        case "End":
          e.preventDefault();
          const lastIndex = nodes.length - 1;
          setFocusedNodeIndex(lastIndex);
          if (nodes[lastIndex]) {
            onNodeSelect?.(nodes[lastIndex]);
          }
          break;

        case "Enter":
        case " ":
          e.preventDefault();
          if (focusedNode) {
            onNodeSelect?.(focusedNode);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    enabled,
    nodes,
    focusNext,
    focusPrevious,
    navigateByPosition,
    focusedNode,
    onNodeSelect,
  ]);

  return {
    focusedNodeIndex,
    focusedNode,
    setFocusedNodeIndex,
  };
}
