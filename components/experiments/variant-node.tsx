"use client";

import { Trophy, TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface VariantNodeProps {
  name: string;
  weight: number;
  status: "draft" | "running" | "winning" | "losing" | "control" | "completed";
  primaryMetric?: {
    label: string;
    value: string;
    change?: number; // percentage change vs control
  };
  secondaryMetrics?: Array<{
    label: string;
    value: string;
  }>;
  sampleSize?: number;
  confidenceLevel?: number; // e.g., 95
  pValue?: number;
  onClick?: () => void;
}

export function VariantNode({
  name,
  weight,
  status,
  primaryMetric,
  secondaryMetrics,
  sampleSize,
  confidenceLevel,
  pValue,
  onClick,
}: VariantNodeProps) {
  // Status-based styling
  const statusStyles = {
    draft: {
      border: "border-dashed border-border/70",
      glow: "",
      bg: "bg-card",
    },
    running: {
      border: "border-blue-400 dark:border-blue-500",
      glow: "animate-pulse",
      bg: "bg-card",
    },
    winning: {
      border: "border-emerald-500 dark:border-emerald-400",
      glow: "shadow-[0_0_20px_rgba(16,185,129,0.3)]",
      bg: "bg-emerald-50/50 dark:bg-emerald-950/20",
    },
    losing: {
      border: "border-red-400 dark:border-red-500 opacity-80",
      glow: "",
      bg: "bg-card",
    },
    control: {
      border: "border-border",
      glow: "",
      bg: "bg-card",
    },
    completed: {
      border: "border-border",
      glow: "",
      bg: "bg-muted/50",
    },
  };

  const style = statusStyles[status];

  return (
    <Card
      onClick={onClick}
      className={cn(
        "w-60 p-4 border-2 transition-all duration-300",
        style.border,
        style.bg,
        style.glow,
        onClick && "cursor-pointer hover:scale-[1.02]",
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm">{name}</h4>
            {status === "winning" && (
              <Trophy className="w-4 h-4 text-emerald-500" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {weight}% weight
            {sampleSize && ` • ${sampleSize} tasks`}
          </p>
        </div>

        {status !== "draft" && status !== "control" && (
          <Badge
            variant={
              status === "winning"
                ? "default"
                : status === "losing"
                  ? "destructive"
                  : "outline"
            }
            className="text-xs"
          >
            {status === "running"
              ? "Running"
              : status === "winning"
                ? "Winner"
                : "Losing"}
          </Badge>
        )}
      </div>

      {/* Primary Metric */}
      {primaryMetric && (
        <div className="mb-3">
          <p className="text-xs text-muted-foreground mb-1">
            {primaryMetric.label}
          </p>
          <div className="flex items-baseline gap-2">
            <p
              className={cn(
                "text-2xl font-bold",
                status === "winning" &&
                  "text-emerald-600 dark:text-emerald-400",
                status === "losing" && "text-red-600 dark:text-red-400",
              )}
            >
              {primaryMetric.value}
            </p>
            {primaryMetric.change !== undefined && (
              <div
                className={cn(
                  "flex items-center text-xs font-medium",
                  primaryMetric.change > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400",
                )}
              >
                {primaryMetric.change > 0 ? (
                  <TrendingUp className="w-3 h-3 mr-0.5" />
                ) : (
                  <TrendingDown className="w-3 h-3 mr-0.5" />
                )}
                {Math.abs(primaryMetric.change)}%
              </div>
            )}
          </div>
        </div>
      )}

      {/* Secondary Metrics */}
      {secondaryMetrics && secondaryMetrics.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {secondaryMetrics.map((metric, idx) => (
            <div key={idx} className="flex justify-between text-xs">
              <span className="text-muted-foreground">{metric.label}</span>
              <span className="font-medium">{metric.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Statistical Significance */}
      {confidenceLevel && pValue !== undefined && (
        <div className="pt-3 border-t border-border/50">
          <Badge variant="outline" className="text-xs">
            {confidenceLevel}% confident
            {pValue < 0.05 && " ✓"}
          </Badge>
        </div>
      )}
    </Card>
  );
}
