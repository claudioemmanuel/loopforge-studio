"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { columns, initialCards, demoPhases } from "./demo-data";
import type { DemoCard } from "./demo-data";
import { KanbanColumn } from "./demo-column";
import { DependencyLines } from "./dependency-lines";
import {
  ProgressDots,
  BrowserChrome,
  BackgroundDecoration,
} from "./browser-chrome";

// ============================================================================
// Main Component
// ============================================================================

interface ModernKanbanProps {
  className?: string;
}

export function ModernKanban({ className = "" }: ModernKanbanProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [cards, setCards] = useState<DemoCard[]>(initialCards);
  const [isPaused, setIsPaused] = useState(false);
  const [executingProgress, setExecutingProgress] = useState(45);

  // Apply phase changes to cards
  const applyPhaseChanges = useCallback((phaseIndex: number) => {
    const phase = demoPhases[phaseIndex];
    if (!phase) return;

    setCards((prevCards) => {
      const newCards = [...prevCards];

      // Reset to initial state on last phase
      if (phaseIndex === demoPhases.length - 1) {
        return initialCards;
      }

      // Apply phase-specific card changes
      phase.cards.forEach((cardUpdate) => {
        const cardIndex = newCards.findIndex((c) => c.id === cardUpdate.id);
        if (cardIndex !== -1) {
          newCards[cardIndex] = { ...newCards[cardIndex], ...cardUpdate };
        }
      });

      return newCards;
    });

    // Reset executing progress at start of execute phase
    if (phaseIndex === 4) {
      setExecutingProgress(45);
    }
  }, []);

  // Animate executing progress during execute phase
  useEffect(() => {
    if (currentPhase === 4 && !isPaused) {
      const interval = setInterval(() => {
        setExecutingProgress((p) => Math.min(p + 3, 85));
      }, 200);
      return () => clearInterval(interval);
    }
  }, [currentPhase, isPaused]);

  // Phase cycling
  useEffect(() => {
    if (isPaused) return;

    const phase = demoPhases[currentPhase];
    if (!phase) return;

    const timeout = setTimeout(() => {
      const nextPhase = (currentPhase + 1) % demoPhases.length;
      setCurrentPhase(nextPhase);
      applyPhaseChanges(nextPhase);
    }, phase.duration);

    return () => clearTimeout(timeout);
  }, [currentPhase, isPaused, applyPhaseChanges]);

  // Initialize with first phase
  useEffect(() => {
    applyPhaseChanges(0);
  }, [applyPhaseChanges]);

  const activeCardId = demoPhases[currentPhase]?.activeCardId || null;
  const dependencyLine = demoPhases[currentPhase]?.showDependencyLine;

  return (
    <div ref={containerRef} className={`relative mx-auto ${className}`}>
      {/* Bottom fade */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background via-background/60 to-transparent z-10 pointer-events-none" />

      <BrowserChrome>
        <BackgroundDecoration />

        {/* Kanban board */}
        <div ref={boardRef} className="relative p-4 overflow-x-auto">
          {/* Dependency lines */}
          <DependencyLines
            cards={cards}
            containerRef={boardRef as React.RefObject<HTMLDivElement>}
            highlightedConnection={dependencyLine}
          />

          {/* Columns */}
          <div className="flex gap-2 min-w-max">
            {columns.map((column) => (
              <KanbanColumn
                key={column.key}
                column={column}
                cards={cards}
                activeCardId={activeCardId}
                onPause={setIsPaused}
                executingProgress={executingProgress}
              />
            ))}
          </div>

          {/* Progress dots */}
          <ProgressDots
            currentPhase={currentPhase}
            totalPhases={demoPhases.length}
          />
        </div>
      </BrowserChrome>

      {/* Glow effect */}
      <div className="absolute -inset-4 bg-primary/5 rounded-2xl blur-2xl -z-20" />

      {/* CSS for rotating gradient border */}
      <style jsx global>{`
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
        .bg-gradient-conic {
          background: conic-gradient(from 0deg, var(--tw-gradient-stops));
        }
      `}</style>
    </div>
  );
}
