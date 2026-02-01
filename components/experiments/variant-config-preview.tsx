"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit2 } from "lucide-react";
import type { ExperimentVariantConfig } from "@/lib/db/schema/types";

interface VariantConfigPreviewProps {
  variantName: string;
  weight: number;
  config: ExperimentVariantConfig;
  onEdit?: () => void;
}

export function VariantConfigPreview({
  variantName,
  weight,
  config,
  onEdit,
}: VariantConfigPreviewProps) {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold">{variantName}</h4>
            <Badge variant="outline">{weight}%</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Type: <span className="font-medium">{config.type}</span>
          </p>
        </div>

        {onEdit && (
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Edit2 className="w-3 h-3" />
          </Button>
        )}
      </div>

      <div className="space-y-2 text-sm">
        {config.type === "prompt" && config.promptOverrides && (
          <div className="space-y-1">
            {Object.entries(config.promptOverrides).map(([key, value]) => (
              <div key={key} className="bg-muted p-2 rounded text-xs">
                <span className="font-medium text-muted-foreground">
                  {key}:
                </span>
                <p className="mt-1 line-clamp-2 text-muted-foreground">
                  {String(value)}
                </p>
              </div>
            ))}
          </div>
        )}

        {config.type === "model" && config.modelOverride && (
          <div className="bg-muted p-2 rounded text-xs">
            <span className="font-medium text-muted-foreground">Model:</span>
            <p className="mt-1">{config.modelOverride}</p>
          </div>
        )}

        {config.type === "parameters" && config.parameterOverrides && (
          <div className="space-y-1">
            {Object.entries(config.parameterOverrides).map(([key, value]) => (
              <div
                key={key}
                className="flex justify-between items-center bg-muted p-2 rounded text-xs"
              >
                <span className="font-medium text-muted-foreground">
                  {key}:
                </span>
                <span className="font-mono">{String(value)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
