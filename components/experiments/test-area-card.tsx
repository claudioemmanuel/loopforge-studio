"use client";

import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface TestAreaCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  examples: string[];
  selected: boolean;
  onClick: () => void;
}

export function TestAreaCard({
  icon: Icon,
  title,
  description,
  examples,
  selected,
  onClick,
}: TestAreaCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left p-6 rounded-xl border-2 transition-all",
        "hover:shadow-lg hover:scale-[1.02]",
        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        selected
          ? "border-primary bg-primary/5 shadow-md"
          : "border-border bg-card hover:border-primary/50",
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "p-3 rounded-lg",
            selected
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="w-6 h-6" />
        </div>

        <div className="flex-1 space-y-2">
          <h3 className="font-semibold text-lg">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>

          {examples.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Examples:
              </p>
              <ul className="text-xs space-y-0.5">
                {examples.map((example, idx) => (
                  <li key={idx} className="text-muted-foreground">
                    • {example}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div className="mt-4 flex items-center gap-2 text-sm font-medium text-primary">
          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
            <svg
              className="w-3 h-3 text-primary-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          Selected
        </div>
      )}
    </button>
  );
}
