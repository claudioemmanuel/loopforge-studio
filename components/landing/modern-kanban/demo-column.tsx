"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { DemoCard, Column } from "./demo-data";
import { TaskCard } from "./demo-card";

// ============================================================================
// Kanban Column Component
// ============================================================================

export interface KanbanColumnProps {
  column: Column;
  cards: DemoCard[];
  activeCardId: string | null;
  onPause: (paused: boolean) => void;
  executingProgress?: number;
}

export function KanbanColumn({
  column,
  cards,
  activeCardId,
  onPause,
  executingProgress,
}: KanbanColumnProps) {
  const shouldReduceMotion = useReducedMotion();
  const Icon = column.Icon;
  const columnCards = cards.filter((c) => c.status === column.key);
  const hasActiveCard = columnCards.some((c) => c.id === activeCardId);

  return (
    <motion.div
      data-column={column.key}
      className={`
        w-[140px] shrink-0 rounded-lg border p-2
        ${column.lightBg} ${column.lightBorder}
        ${column.darkBg} ${column.darkBorder}
        transition-all duration-300
        ${hasActiveCard ? "ring-2 ring-offset-1 ring-offset-white dark:ring-offset-slate-900" : ""}
      `}
      style={
        hasActiveCard
          ? ({ "--tw-ring-color": column.accent } as React.CSSProperties)
          : {}
      }
      animate={
        hasActiveCard && !shouldReduceMotion
          ? {
              boxShadow: [
                `0 0 0 0 ${column.accent}20`,
                `0 0 0 4px ${column.accent}10`,
                `0 0 0 0 ${column.accent}20`,
              ],
            }
          : {}
      }
      transition={
        hasActiveCard && !shouldReduceMotion
          ? { boxShadow: { duration: 2, repeat: Infinity } }
          : {}
      }
    >
      {/* Column header */}
      <div className="flex items-center gap-1 mb-2 px-0.5">
        <motion.div
          animate={
            hasActiveCard && !shouldReduceMotion
              ? { rotate: [0, 10, -10, 0] }
              : {}
          }
          transition={
            hasActiveCard
              ? { duration: 0.5, repeat: Infinity, repeatDelay: 2 }
              : {}
          }
        >
          <Icon className={`w-3 h-3 ${column.lightText} ${column.darkText}`} />
        </motion.div>
        <span
          className={`text-[9px] font-semibold ${column.lightText} ${column.darkText}`}
        >
          {column.label}
        </span>
        <span
          className={`ml-auto text-[8px] font-medium px-1 py-0.5 rounded-full bg-white/60 dark:bg-slate-800/60 ${column.lightText} ${column.darkText}`}
        >
          {columnCards.length}
        </span>
      </div>

      {/* Column body */}
      <div className="h-[300px] space-y-2 overflow-hidden">
        <AnimatePresence mode="popLayout">
          {columnCards.map((card) => (
            <TaskCard
              key={card.id}
              card={card}
              column={column}
              isActive={card.id === activeCardId}
              onPause={onPause}
              executingProgress={
                card.status === "executing" ? executingProgress : undefined
              }
            />
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
