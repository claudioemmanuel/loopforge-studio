"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { DemoCard, Column } from "./demo-data";
import { TaskCard } from "./demo-card";
import { useSquircle } from "@/components/ui/squircle";

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
  const columnSquircle = useSquircle({ cornerRadius: "lg" });
  const badgeSquircle = useSquircle({ cornerRadius: "full" });

  return (
    <motion.div
      ref={columnSquircle.ref as React.RefObject<HTMLDivElement>}
      data-column={column.key}
      className={`
        w-[140px] shrink-0 rounded-lg p-2
        ${column.lightBg} ${column.lightBorder}
        ${column.darkBg} ${column.darkBorder}
        transition-all duration-300
      `}
      style={{
        ...columnSquircle.style,
        ...(hasActiveCard
          ? ({ "--tw-ring-color": column.accent } as React.CSSProperties)
          : {}),
      }}
      animate={
        hasActiveCard && !shouldReduceMotion
          ? {
              filter: [
                `drop-shadow(0 0 0px ${column.accent}20)`,
                `drop-shadow(0 0 4px ${column.accent}40)`,
                `drop-shadow(0 0 0px ${column.accent}20)`,
              ],
            }
          : { filter: "drop-shadow(0 0 0px transparent)" }
      }
      transition={
        hasActiveCard && !shouldReduceMotion
          ? { filter: { duration: 2, repeat: Infinity } }
          : {}
      }
    >
      {/* SVG border overlay */}
      {columnSquircle.svgPath && (
        <svg
          aria-hidden
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ position: "absolute", inset: 0 }}
        >
          <path
            d={columnSquircle.svgPath}
            fill="none"
            stroke={hasActiveCard ? column.accent : "hsl(var(--border))"}
            strokeWidth={hasActiveCard ? 2 : 1}
            className="transition-all duration-300"
          />
        </svg>
      )}

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
          ref={badgeSquircle.ref as React.RefObject<HTMLSpanElement>}
          className={`ml-auto text-[8px] font-medium px-1 py-0.5 rounded-full bg-white/60 dark:bg-slate-800/60 ${column.lightText} ${column.darkText}`}
          style={badgeSquircle.style}
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
