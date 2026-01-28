"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  index: number;
  isVisible: boolean;
}

export function FeatureCard({
  icon: Icon,
  title,
  description,
  index,
  isVisible,
}: FeatureCardProps) {
  return (
    <div
      className={cn(
        "group relative p-6 rounded-xl border border-border bg-card/50 backdrop-blur-sm",
        "transition-all duration-300",
        "hover:-translate-y-1 hover:shadow-lg hover:bg-card/80",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
      )}
      style={{
        transitionDelay: isVisible ? `${index * 100}ms` : "0ms",
      }}
    >
      <div className="flex flex-col gap-4">
        <div
          className={cn(
            "flex-shrink-0 w-12 h-12 rounded-lg",
            "bg-primary/10 group-hover:bg-primary/20",
            "flex items-center justify-center",
            "transition-colors duration-300",
          )}
        >
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
