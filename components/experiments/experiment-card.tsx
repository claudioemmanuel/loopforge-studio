"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Pause, CheckCircle, BarChart3 } from "lucide-react";
import { useState } from "react";

interface ExperimentCardProps {
  experiment: {
    id: string;
    name: string;
    description: string;
    status: "draft" | "active" | "paused" | "completed";
    trafficAllocation: number;
    startDate: string | null;
    variants: Array<{ name: string; weight: number }>;
  };
  onViewResults: () => void;
  onRefresh: () => void;
}

export function ExperimentCard({
  experiment,
  onViewResults,
  onRefresh,
}: ExperimentCardProps) {
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

  const config = statusConfig[experiment.status];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg">{experiment.name}</CardTitle>
          <Badge variant={config.variant}>{config.label}</Badge>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {experiment.description}
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Variants */}
        <div>
          <p className="text-sm font-medium mb-2">Variants</p>
          <div className="space-y-1">
            {experiment.variants.map((variant) => (
              <div key={variant.name} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{variant.name}</span>
                <span className="font-medium">{variant.weight}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Traffic allocation */}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Traffic</span>
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
            <BarChart3 className="w-4 h-4 mr-2" />
            Results
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
