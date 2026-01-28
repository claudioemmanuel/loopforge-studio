"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { Task } from "@/lib/db/schema";

interface DependencyHighlightContextValue {
  hoveredTaskId: string | null;
  blockerIds: string[];
  blockedByIds: string[];
  dependencyChainIds: string[];
  hasConnections: boolean;
  setHoveredTask: (
    taskId: string | null,
    task?: Task,
    allTasks?: Task[],
  ) => void;
  isBlocker: (taskId: string) => boolean;
  isBlocked: (taskId: string) => boolean;
  isUnrelated: (taskId: string) => boolean;
  isInChain: (taskId: string) => boolean;
}

const DependencyHighlightContext =
  createContext<DependencyHighlightContextValue | null>(null);

interface DependencyHighlightProviderProps {
  children: ReactNode;
}

/**
 * Computes the full dependency chain for a task using BFS traversal.
 * Traverses both directions: tasks that block this one and tasks blocked by this one.
 */
function computeFullDependencyChain(taskId: string, allTasks: Task[]) {
  const visited = new Set<string>();
  const chainIds: string[] = [];

  // Build adjacency maps
  const blocksMap = new Map<string, string[]>(); // taskId -> tasks it blocks
  const blockedByMap = new Map<string, string[]>(); // taskId -> tasks that block it

  allTasks.forEach((t) => {
    const blockedBy = (t.blockedByIds as string[]) || [];
    blockedByMap.set(t.id, blockedBy);
    blockedBy.forEach((blockerId) => {
      const existing = blocksMap.get(blockerId) || [];
      existing.push(t.id);
      blocksMap.set(blockerId, existing);
    });
  });

  // BFS traversal in both directions
  function traverse(id: string) {
    if (visited.has(id)) return;
    // Validate task exists in allTasks
    if (!allTasks.some((t) => t.id === id)) return;
    visited.add(id);
    chainIds.push(id);
    (blockedByMap.get(id) || []).forEach(traverse); // up the chain (blockers)
    (blocksMap.get(id) || []).forEach(traverse); // down the chain (blocked tasks)
  }

  traverse(taskId);

  return {
    chainIds,
    blockerIds: blockedByMap.get(taskId) || [],
    blockedByIds: blocksMap.get(taskId) || [],
  };
}

export function DependencyHighlightProvider({
  children,
}: DependencyHighlightProviderProps) {
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [blockerIds, setBlockerIds] = useState<string[]>([]);
  const [blockedByIds, setBlockedByIds] = useState<string[]>([]);
  const [dependencyChainIds, setDependencyChainIds] = useState<string[]>([]);

  const setHoveredTask = useCallback(
    (taskId: string | null, task?: Task, allTasks?: Task[]) => {
      setHoveredTaskId(taskId);

      if (!taskId || !task || !allTasks) {
        setBlockerIds([]);
        setBlockedByIds([]);
        setDependencyChainIds([]);
        return;
      }

      // Compute full dependency chain via graph traversal
      const result = computeFullDependencyChain(taskId, allTasks);

      // Filter to only include valid task IDs that exist in allTasks
      const validBlockerIds = result.blockerIds.filter((id) =>
        allTasks.some((t) => t.id === id),
      );

      setBlockerIds(validBlockerIds);
      setBlockedByIds(result.blockedByIds);
      setDependencyChainIds(result.chainIds);
    },
    [],
  );

  const isBlocker = useCallback(
    (taskId: string) => blockerIds.includes(taskId),
    [blockerIds],
  );

  const isBlocked = useCallback(
    (taskId: string) => blockedByIds.includes(taskId),
    [blockedByIds],
  );

  const isUnrelated = useCallback(
    (taskId: string) => {
      if (!hoveredTaskId) return false;
      if (taskId === hoveredTaskId) return false;
      return !blockerIds.includes(taskId) && !blockedByIds.includes(taskId);
    },
    [hoveredTaskId, blockerIds, blockedByIds],
  );

  const isInChain = useCallback(
    (taskId: string) => dependencyChainIds.includes(taskId),
    [dependencyChainIds],
  );

  // hasConnections is true if the chain has 2+ tasks (the hovered task plus at least one connected task)
  const hasConnections = useMemo(
    () => dependencyChainIds.length >= 2,
    [dependencyChainIds],
  );

  const value = useMemo(
    () => ({
      hoveredTaskId,
      blockerIds,
      blockedByIds,
      dependencyChainIds,
      hasConnections,
      setHoveredTask,
      isBlocker,
      isBlocked,
      isUnrelated,
      isInChain,
    }),
    [
      hoveredTaskId,
      blockerIds,
      blockedByIds,
      dependencyChainIds,
      hasConnections,
      setHoveredTask,
      isBlocker,
      isBlocked,
      isUnrelated,
      isInChain,
    ],
  );

  return (
    <DependencyHighlightContext.Provider value={value}>
      {children}
    </DependencyHighlightContext.Provider>
  );
}

export function useDependencyHighlight() {
  const context = useContext(DependencyHighlightContext);
  if (!context) {
    throw new Error(
      "useDependencyHighlight must be used within a DependencyHighlightProvider",
    );
  }
  return context;
}
