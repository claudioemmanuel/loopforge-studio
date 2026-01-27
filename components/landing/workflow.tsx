"use client";

import {
  CircleDot,
  Lightbulb,
  FileText,
  CheckCircle,
  Play,
  CheckCheck,
  AlertCircle,
  ChevronRight,
} from "lucide-react";

const stages = [
  {
    name: "Todo",
    color: "bg-kanban-todo",
    borderColor: "border-kanban-todo",
    textColor: "text-kanban-todo",
    Icon: CircleDot,
    description: "Tasks waiting to be started",
    detail: "Add tasks via GitHub issues or the dashboard",
  },
  {
    name: "Brainstorm",
    color: "bg-kanban-brainstorming",
    borderColor: "border-kanban-brainstorming",
    textColor: "text-kanban-brainstorming",
    Icon: Lightbulb,
    description: "Refine requirements with AI",
    detail: "Chat to clarify scope and edge cases",
  },
  {
    name: "Plan",
    color: "bg-kanban-planning",
    borderColor: "border-kanban-planning",
    textColor: "text-kanban-planning",
    Icon: FileText,
    description: "AI generates implementation plan",
    detail: "Review and approve before execution",
  },
  {
    name: "Ready",
    color: "bg-kanban-ready",
    borderColor: "border-kanban-ready",
    textColor: "text-kanban-ready",
    Icon: CheckCircle,
    description: "Approved and queued",
    detail: "Waiting in priority queue for execution",
  },
  {
    name: "Execute",
    color: "bg-kanban-executing",
    borderColor: "border-kanban-executing",
    textColor: "text-kanban-executing",
    Icon: Play,
    description: "AI writes code in real-time",
    detail: "Watch progress with live streaming logs",
  },
  {
    name: "Done",
    color: "bg-kanban-done",
    borderColor: "border-kanban-done",
    textColor: "text-kanban-done",
    Icon: CheckCheck,
    description: "Completed and committed",
    detail: "PR created and ready for review",
  },
];

export function Workflow() {
  return (
    <section id="workflow" className="py-24 px-6 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center space-y-4 mb-20">
          <h2 className="text-3xl md:text-4xl font-serif font-bold tracking-tight">
            A workflow that <span className="text-primary">actually works</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Six stages from idea to shipped code. Every task moves through the
            same predictable flow.
          </p>
        </div>

        {/* Workflow visualization - horizontal timeline */}
        <div className="relative mb-20">
          {/* Connection line */}
          <div className="absolute top-8 left-0 right-0 h-0.5 bg-gradient-to-r from-kanban-todo via-kanban-planning to-kanban-done hidden lg:block" />

          {/* Stage nodes */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 lg:gap-4">
            {stages.map((stage, i) => {
              const Icon = stage.Icon;
              return (
                <div
                  key={stage.name}
                  className="flex flex-col items-center group"
                >
                  {/* Node */}
                  <div className="relative">
                    <div
                      className={`
                        w-16 h-16 rounded-full ${stage.color}
                        flex items-center justify-center
                        shadow-lg transition-all duration-300
                        group-hover:scale-110 group-hover:shadow-xl
                        ring-4 ring-background
                      `}
                    >
                      <Icon className="w-7 h-7 text-white" strokeWidth={2} />
                    </div>
                    {/* Step number */}
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-background border-2 border-border flex items-center justify-center">
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        {i + 1}
                      </span>
                    </div>
                  </div>

                  {/* Label */}
                  <div className="mt-4 text-center">
                    <h4 className={`font-semibold text-sm ${stage.textColor}`}>
                      {stage.name}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[140px]">
                      {stage.description}
                    </p>
                  </div>

                  {/* Chevron connector for mobile/tablet */}
                  {i < stages.length - 1 && (
                    <ChevronRight className="absolute right-0 top-8 -translate-y-1/2 w-5 h-5 text-muted-foreground/40 hidden md:block lg:hidden" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Stuck state callout */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-3 px-5 py-3 rounded-full border border-kanban-stuck/30 bg-kanban-stuck/5">
            <div className="w-8 h-8 rounded-full bg-kanban-stuck flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-white" />
            </div>
            <div className="text-left">
              <span className="text-sm font-medium text-kanban-stuck">
                Stuck
              </span>
              <span className="text-sm text-muted-foreground ml-2">
                — Tasks move here when AI needs human input
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
