"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ExperimentResultsModalProps {
  experimentId: string;
  onClose: () => void;
}

interface AnalysisData {
  experimentName: string;
  metricName: string;
  variants: Array<{
    variantName: string;
    sampleSize: number;
    mean: number;
    stdDev: number;
    min: number;
    max: number;
  }>;
  comparison: {
    control: { variantName: string; mean: number; sampleSize: number };
    treatment: { variantName: string; mean: number; sampleSize: number };
    tStatistic: number;
    pValue: number;
    confidenceInterval: { lower: number; upper: number };
    recommendation: "continue" | "rollout" | "stop";
    significanceLevel: number;
  } | null;
  isSignificant: boolean;
}

export function ExperimentResultsModal({
  experimentId,
  onClose,
}: ExperimentResultsModalProps) {
  const [selectedMetric, setSelectedMetric] = useState("task_success");
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResults();
  }, [experimentId, selectedMetric]);

  async function fetchResults() {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/experiments/${experimentId}/results?metric=${selectedMetric}`,
      );
      const data = await response.json();
      setAnalysis(data.analysis);
    } catch (error) {
      console.error("Failed to fetch results:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Loading Results...</DialogTitle>
          </DialogHeader>
          <div className="h-96 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!analysis || !analysis.comparison) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Insufficient Data</DialogTitle>
          </DialogHeader>
          <div className="text-center py-12 text-muted-foreground">
            Not enough data to perform statistical analysis yet.
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const { comparison, variants, isSignificant } = analysis;
  const recommendationConfig = {
    continue: {
      label: "Continue Testing",
      icon: Minus,
      color: "text-yellow-500",
    },
    rollout: {
      label: "Rollout Treatment",
      icon: TrendingUp,
      color: "text-green-500",
    },
    stop: {
      label: "Stop Experiment",
      icon: TrendingDown,
      color: "text-red-500",
    },
  };
  const recConfig = recommendationConfig[comparison.recommendation];
  const RecommendationIcon = recConfig.icon;

  // Chart data
  const chartData = variants.map((v) => ({
    name: v.variantName,
    mean: v.mean,
    sampleSize: v.sampleSize,
  }));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {analysis.experimentName}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={selectedMetric} onValueChange={setSelectedMetric}>
          <TabsList>
            <TabsTrigger value="task_success">Success Rate</TabsTrigger>
            <TabsTrigger value="iterations_count">Iterations</TabsTrigger>
            <TabsTrigger value="token_count">Token Usage</TabsTrigger>
            <TabsTrigger value="execution_time_seconds">
              Execution Time
            </TabsTrigger>
          </TabsList>

          <TabsContent value={selectedMetric} className="space-y-6">
            {/* Recommendation Banner */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <RecommendationIcon
                    className={`w-12 h-12 ${recConfig.color}`}
                  />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{recConfig.label}</h3>
                    <p className="text-sm text-muted-foreground">
                      {isSignificant
                        ? `Statistically significant difference detected (p=${comparison.pValue.toFixed(4)})`
                        : `No significant difference yet (p=${comparison.pValue.toFixed(4)})`}
                    </p>
                  </div>
                  <Badge variant={isSignificant ? "default" : "secondary"}>
                    {isSignificant ? "Significant" : "Not Significant"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Statistical Summary */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    T-Statistic
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {comparison.tStatistic.toFixed(3)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">P-Value</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {comparison.pValue.toFixed(4)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    α = {comparison.significanceLevel}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    Confidence Interval (95%)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-mono">
                    [{comparison.confidenceInterval.lower.toFixed(3)},{" "}
                    {comparison.confidenceInterval.upper.toFixed(3)}]
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Variant Comparison Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Variant Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="mean" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Variant Details Table */}
            <Card>
              <CardHeader>
                <CardTitle>Variant Details</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Variant</th>
                      <th className="text-right py-2">Sample Size</th>
                      <th className="text-right py-2">Mean</th>
                      <th className="text-right py-2">Std Dev</th>
                      <th className="text-right py-2">Min</th>
                      <th className="text-right py-2">Max</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((variant) => (
                      <tr key={variant.variantName} className="border-b">
                        <td className="py-2 font-medium">
                          {variant.variantName}
                        </td>
                        <td className="text-right py-2">
                          {variant.sampleSize}
                        </td>
                        <td className="text-right py-2">
                          {variant.mean.toFixed(3)}
                        </td>
                        <td className="text-right py-2">
                          {variant.stdDev.toFixed(3)}
                        </td>
                        <td className="text-right py-2">
                          {variant.min.toFixed(3)}
                        </td>
                        <td className="text-right py-2">
                          {variant.max.toFixed(3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
