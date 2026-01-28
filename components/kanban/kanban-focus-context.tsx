"use client";

import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import type { Task, TaskStatus } from "@/lib/db/schema";

// Column order for navigation
const COLUMN_ORDER: TaskStatus[] = [
  "todo",
  "brainstorming",
  "planning",
  "ready",
  "executing",
  "review",
  "done",
  "stuck",
];

interface KanbanFocusContextType {
  focusedTaskId: string | null;
  setFocusedTaskId: (id: string | null) => void;
  registerCard: (id: string, element: HTMLElement) => void;
  unregisterCard: (id: string) => void;
  focusNext: () => void;
  focusPrevious: () => void;
  focusNextColumn: () => void;
  focusPreviousColumn: () => void;
}

const KanbanFocusContext = createContext<KanbanFocusContextType | null>(null);

interface KanbanFocusProviderProps {
  children: ReactNode;
  tasks: Task[];
}

export function KanbanFocusProvider({
  children,
  tasks,
}: KanbanFocusProviderProps) {
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const cardElements = useRef<Map<string, HTMLElement>>(new Map());

  const registerCard = useCallback((id: string, element: HTMLElement) => {
    cardElements.current.set(id, element);
  }, []);

  const unregisterCard = useCallback((id: string) => {
    cardElements.current.delete(id);
  }, []);

  // Build ordered list of tasks by column then by position within column
  const getOrderedTasks = useCallback(() => {
    const ordered: Task[] = [];
    for (const col of COLUMN_ORDER) {
      const colTasks = tasks.filter((t) => t.status === col);
      ordered.push(...colTasks);
    }
    return ordered;
  }, [tasks]);

  const focusTask = useCallback((taskId: string) => {
    setFocusedTaskId(taskId);
    const el = cardElements.current.get(taskId);
    if (el) {
      el.focus({ preventScroll: false });
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, []);

  const focusNext = useCallback(() => {
    const ordered = getOrderedTasks();
    if (ordered.length === 0) return;

    if (!focusedTaskId) {
      focusTask(ordered[0].id);
      return;
    }

    const idx = ordered.findIndex((t) => t.id === focusedTaskId);
    if (idx < ordered.length - 1) {
      focusTask(ordered[idx + 1].id);
    }
  }, [focusedTaskId, getOrderedTasks, focusTask]);

  const focusPrevious = useCallback(() => {
    const ordered = getOrderedTasks();
    if (ordered.length === 0) return;

    if (!focusedTaskId) {
      focusTask(ordered[ordered.length - 1].id);
      return;
    }

    const idx = ordered.findIndex((t) => t.id === focusedTaskId);
    if (idx > 0) {
      focusTask(ordered[idx - 1].id);
    }
  }, [focusedTaskId, getOrderedTasks, focusTask]);

  const focusNextColumn = useCallback(() => {
    const ordered = getOrderedTasks();
    if (ordered.length === 0) return;

    // Find current column
    const currentTask = focusedTaskId
      ? tasks.find((t) => t.id === focusedTaskId)
      : null;
    const currentColIdx = currentTask
      ? COLUMN_ORDER.indexOf(currentTask.status)
      : -1;

    // Find next column that has tasks
    for (let i = currentColIdx + 1; i < COLUMN_ORDER.length; i++) {
      const colTasks = ordered.filter((t) => t.status === COLUMN_ORDER[i]);
      if (colTasks.length > 0) {
        focusTask(colTasks[0].id);
        return;
      }
    }
  }, [focusedTaskId, tasks, getOrderedTasks, focusTask]);

  const focusPreviousColumn = useCallback(() => {
    const ordered = getOrderedTasks();
    if (ordered.length === 0) return;

    // Find current column
    const currentTask = focusedTaskId
      ? tasks.find((t) => t.id === focusedTaskId)
      : null;
    const currentColIdx = currentTask
      ? COLUMN_ORDER.indexOf(currentTask.status)
      : COLUMN_ORDER.length;

    // Find previous column that has tasks
    for (let i = currentColIdx - 1; i >= 0; i--) {
      const colTasks = ordered.filter((t) => t.status === COLUMN_ORDER[i]);
      if (colTasks.length > 0) {
        focusTask(colTasks[0].id);
        return;
      }
    }
  }, [focusedTaskId, tasks, getOrderedTasks, focusTask]);

  return (
    <KanbanFocusContext.Provider
      value={{
        focusedTaskId,
        setFocusedTaskId,
        registerCard,
        unregisterCard,
        focusNext,
        focusPrevious,
        focusNextColumn,
        focusPreviousColumn,
      }}
    >
      {children}
    </KanbanFocusContext.Provider>
  );
}

export function useKanbanFocus() {
  const context = useContext(KanbanFocusContext);
  if (!context) {
    throw new Error("useKanbanFocus must be used within a KanbanFocusProvider");
  }
  return context;
}
