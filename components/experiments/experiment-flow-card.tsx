"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Pause, CheckCircle } from "lucide-react";
import { VariantNode } from "./variant-node";

interface Variant {
  id: string;
  name: string;
  weight: number;
  config: unknown;
  // Metrics (would come from API in real implementation)
  metrics?: {
    sampleSize: number;
    successRate?: number;
    avgDuration?: number;
    errorRate?: number;
  };
  performance?: {
    change: number; // percentage vs control
    isWinning: boolean;
    confidenceLevel?: number;
    pValue?: number;
  };
}

interface ExperimentFlowCardProps {
  experiment: {
    id: string;
    name: string;
    description: string;
    status: "draft" | "active" | "paused" | "completed";
    trafficAllocation: number;
    startDate: string | null;
    variants: Variant[];
  };
  onViewResults: () => void;
  onRefresh: () => void;
}

export function ExperimentFlowCard({
  experiment,
  onViewResults,
  onRefresh,
}: ExperimentFlowCardProps) {
  const [actionLoading, setActionLoading] = useState(false);

  const statusConfig = {
    draft: {
      label: "Draft",
      variant: "secondary" as const,
      color: "text-gray-500",
    },
    active: {
      label: "Active",
      variant: "default" as const,
      color: "text-green-500",
    },
    paused: {
      label: "Paused",
      variant: "outline" as const,
      color: "text-yellow-500",
    },
    completed: {
      label: "Completed",
      variant: "outline" as const,
      color: "text-blue-500",
    },
  };

  async function handleStatusChange(newStatus: string) {
    setActionLoading(true);
    try {
      await fetch(`/api/experiments/${experiment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      onRefresh();
    } catch (error) {
      console.error("Failed to update experiment status:", error);
    } finally {
      setActionLoading(false);
    }
  }

  // Determine variant status
  const getVariantStatus = (
    variant: Variant,
    index: number,
  ): "draft" | "running" | "winning" | "losing" | "control" | "completed" => {
    if (experiment.status === "draft") return "draft";
    if (experiment.status === "completed") return "completed";

    // First variant is control
    if (index === 0) return "control";

    // Check if we have performance data
    if (variant.performance) {
      if (variant.performance.isWinning) return "winning";
      if (variant.performance.change < -5) return "losing"; // More than 5% worse
    }

    return "running";
  };

  const config = statusConfig[experiment.status];

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{experiment.name}</CardTitle>
              <Badge variant={config.variant}>{config.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {experiment.description}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Flow Visualization */}
        <div className="relative">
          <div className="flex items-center justify-between gap-6 overflow-x-auto pb-4">
            {experiment.variants.map((variant, idx) => {
              const status = getVariantStatus(variant, idx);
              const isControl = idx === 0;

              // Calculate metrics for display
              const primaryMetric = variant.metrics?.successRate
                ? {
                    label: "Success Rate",
                    value: `${variant.metrics.successRate}%`,
                    change: variant.performance?.change,
                  }
                : undefined;

              const secondaryMetrics = variant.metrics
                ? [
                    {
                      label: "Avg Duration",
                      value: variant.metrics.avgDuration
                        ? `${variant.metrics.avgDuration}s`
                        : "N/A",
                    },
                    {
                      label: "Error Rate",
                      value: variant.metrics.errorRate
                        ? `${variant.metrics.errorRate}%`
                        : "0%",
                    },
                  ]
                : [];

              return (
                <div key={variant.id} className="flex-shrink-0">
                  <VariantNode
                    name={
                      isControl ? `${variant.name} (Control)` : variant.name
                    }
                    weight={variant.weight}
                    status={status}
                    primaryMetric={primaryMetric}
                    secondaryMetrics={secondaryMetrics}
                    sampleSize={variant.metrics?.sampleSize}
                    confidenceLevel={variant.performance?.confidenceLevel}
                    pValue={variant.performance?.pValue}
                    onClick={onViewResults}
                  />
                </div>
              );
            })}
          </div>

          {/* Connection lines would be rendered here with FlowConnector */}
          {/* This would require more complex positioning logic in production */}
        </div>

        {/* Traffic allocation */}
        <div className="flex justify-between text-sm border-t pt-4">
          <span className="text-muted-foreground">Traffic Allocation</span>
          <span className="font-medium">{experiment.trafficAllocation}%</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={onViewResults}
          >
            View Details
          </Button>

          {experiment.status === "draft" && (
            <Button
              size="sm"
              onClick={() => handleStatusChange("active")}
              disabled={actionLoading}
            >
              <Play className="w-4 h-4 mr-2" />
              Start
            </Button>
          )}

          {experiment.status === "active" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStatusChange("paused")}
              disabled={actionLoading}
            >
              <Pause className="w-4 h-4 mr-2" />
              Pause
            </Button>
          )}

          {(experiment.status === "active" ||
            experiment.status === "paused") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStatusChange("completed")}
              disabled={actionLoading}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Complete
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
