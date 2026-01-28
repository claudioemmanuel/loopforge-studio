"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  MeasuringStrategy,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard } from "./kanban-card";
import { DependencyHighlightProvider } from "./dependency-highlight-context";
import { DependencyLines } from "./dependency-lines";
import { cn } from "@/lib/utils";
import { KanbanFocusProvider, useKanbanFocus } from "./kanban-focus-context";
import { useKeyboardShortcuts } from "@/components/hooks/use-keyboard-shortcuts";
import type { Task, TaskStatus } from "@/lib/db/schema";
import type { CardProcessingState } from "@/components/hooks/use-card-processing";

interface KanbanBoardProps {
  tasks: Task[];
  onTaskMove: (taskId: string, newStatus: TaskStatus) => void;
  onTaskClick: (task: Task) => void;
  onTaskDelete?: (taskId: string) => void;
  onTaskStart?: (taskId: string) => Promise<void>;
  onTaskAdvance?: (
    taskId: string,
    action: "plan" | "ready" | "execute",
  ) => Promise<void>;
  onAddTask?: () => void;
  processingCards?: Map<string, CardProcessingState>;
  slidingCards?: Set<string>;
}

// Column definitions with workflow order
export const columns: { id: TaskStatus; title: string; description: string }[] =
  [
    { id: "todo", title: "To Do", description: "Tasks waiting to start" },
    {
      id: "brainstorming",
      title: "Brainstorming",
      description: "AI generating ideas",
    },
    {
      id: "planning",
      title: "Planning",
      description: "Creating execution plans",
    },
    { id: "ready", title: "Ready", description: "Ready to execute" },
    { id: "executing", title: "Executing", description: "AI working on code" },
    {
      id: "review",
      title: "Review",
      description: "Changes ready for approval",
    },
    { id: "done", title: "Done", description: "Completed tasks" },
    {
      id: "stuck",
      title: "Failed",
      description: "Tasks that encountered errors",
    },
  ];

// Measuring configuration for smoother animations
const measuringConfig = {
  droppable: {
    strategy: MeasuringStrategy.Always,
  },
};

export function KanbanBoard(props: KanbanBoardProps) {
  return (
    <KanbanFocusProvider tasks={props.tasks}>
      <KanbanBoardInner {...props} />
    </KanbanFocusProvider>
  );
}

function KanbanBoardInner({
  tasks,
  onTaskMove,
  onTaskClick,
  onTaskDelete,
  onTaskStart,
  onTaskAdvance,
  onAddTask,
  processingCards,
  slidingCards,
}: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const boardContainerRef = useRef<HTMLDivElement>(null);

  // Focus management and keyboard shortcuts
  const {
    focusedTaskId,
    focusNext,
    focusPrevious,
    focusNextColumn,
    focusPreviousColumn,
  } = useKanbanFocus();

  useKeyboardShortcuts(
    useMemo(
      () => [
        { key: "j", action: focusNext, description: "Focus next card" },
        { key: "ArrowDown", action: focusNext, description: "Focus next card" },
        { key: "k", action: focusPrevious, description: "Focus previous card" },
        {
          key: "ArrowUp",
          action: focusPrevious,
          description: "Focus previous card",
        },
        {
          key: "ArrowRight",
          action: focusNextColumn,
          description: "Focus next column",
        },
        {
          key: "ArrowLeft",
          action: focusPreviousColumn,
          description: "Focus previous column",
        },
        {
          key: "Enter",
          action: () => {
            if (focusedTaskId) {
              const task = tasks.find((t) => t.id === focusedTaskId);
              if (task) onTaskClick(task);
            }
          },
          description: "Open focused task",
          enabled: !!focusedTaskId,
        },
        {
          key: "n",
          action: () => {
            if (onAddTask) onAddTask();
          },
          description: "New task",
          enabled: !!onAddTask,
        },
      ],
      [
        focusNext,
        focusPrevious,
        focusNextColumn,
        focusPreviousColumn,
        focusedTaskId,
        tasks,
        onTaskClick,
        onAddTask,
      ],
    ),
  );

  // Configure sensors with activation constraints for smoother UX
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Minimum drag distance before activation
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Memoized task grouping by status
  const tasksByStatus = useMemo(() => {
    const grouped = new Map<TaskStatus, Task[]>();
    columns.forEach((col) => grouped.set(col.id, []));
    tasks.forEach((task) => {
      const group = grouped.get(task.status);
      if (group) group.push(task);
    });
    return grouped;
  }, [tasks]);

  // Get tasks for a specific status
  const getTasksByStatus = useCallback(
    (status: TaskStatus) => tasksByStatus.get(status) || [],
    [tasksByStatus],
  );

  // Handle drag start - store active task for overlay
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const task = tasks.find((t) => t.id === event.active.id);
      if (task) {
        setActiveTask(task);
        // Add haptic feedback on mobile (if supported)
        if (navigator.vibrate) {
          navigator.vibrate(10);
        }
      }
    },
    [tasks],
  );

  // Handle drag end - update task status
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveTask(null);

      if (!over) return;

      const taskId = active.id as string;
      const overId = over.id as string;

      // Find the current task
      const currentTask = tasks.find((t) => t.id === taskId);
      if (!currentTask) return;

      // Check if dropped on a column
      const isColumn = columns.some((c) => c.id === overId);
      if (isColumn) {
        // Only update if status changed
        if (currentTask.status !== overId) {
          onTaskMove(taskId, overId as TaskStatus);
        }
        return;
      }

      // Dropped on another task - find its column
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask && currentTask.status !== overTask.status) {
        onTaskMove(taskId, overTask.status);
      }
    },
    [tasks, onTaskMove],
  );

  // Handle drag cancel
  const handleDragCancel = useCallback(() => {
    setActiveTask(null);
  }, []);

  return (
    <DependencyHighlightProvider>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        measuring={measuringConfig}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {/* Board Container */}
        <div className="h-full flex flex-col relative">
          {/* Mobile scroll fade hints */}
          <div className="absolute left-0 top-0 bottom-4 w-4 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none md:hidden" />
          <div className="absolute right-0 top-0 bottom-4 w-4 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none md:hidden" />

          {/* Horizontal Scrollable Board */}
          <div
            ref={boardContainerRef}
            className="flex-1 overflow-x-auto overflow-y-hidden pb-4 scrollbar-hide relative"
          >
            {/* SVG dependency lines layer - renders on hover when connections exist */}
            <DependencyLines
              tasks={tasks}
              containerRef={boardContainerRef as React.RefObject<HTMLElement>}
            />

            <div className="flex gap-4 min-w-max h-full px-1 pt-1">
              {columns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  id={column.id}
                  title={column.title}
                  tasks={getTasksByStatus(column.id)}
                  allTasks={tasks}
                  onTaskClick={onTaskClick}
                  onTaskDelete={onTaskDelete}
                  onTaskMove={onTaskMove}
                  onTaskStart={onTaskStart}
                  onTaskAdvance={onTaskAdvance}
                  onAddTask={column.id === "todo" ? onAddTask : undefined}
                  processingCards={processingCards}
                  slidingCards={slidingCards}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Drag Overlay - Floating card during drag */}
        <DragOverlay
          dropAnimation={{
            duration: 200,
            easing: "cubic-bezier(0.25, 1, 0.5, 1)",
          }}
        >
          {activeTask && (
            <div className="w-[276px]">
              <KanbanCard task={activeTask} onClick={() => {}} isDragOverlay />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </DependencyHighlightProvider>
  );
}
