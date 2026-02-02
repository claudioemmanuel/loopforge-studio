"use client";

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";

interface TokenUsageChartProps {
  data?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    avgPerTask: number;
  } | null;
}

function formatTokens(num: number | undefined | null): string {
  if (num == null || isNaN(num)) return "0";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
  return num.toString();
}

export function TokenUsageChart({ data }: TokenUsageChartProps) {
  const safeData = data ?? {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    avgPerTask: 0,
  };

  const chartData = [
    { name: "Input", value: safeData.inputTokens },
    { name: "Output", value: safeData.outputTokens },
  ];

  return (
    <div className="p-6 rounded-xl border bg-card">
      <h3 className="text-sm font-serif font-medium text-muted-foreground mb-4">
        Token Consumption
      </h3>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical">
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={60}
              tick={{ fontSize: 12 }}
            />
            <Bar
              dataKey="value"
              fill="hsl(var(--primary))"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 pt-4 border-t space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total</span>
          <span className="font-medium">
            {formatTokens(safeData.totalTokens)} tokens
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Avg per task</span>
          <span className="font-medium">
            {formatTokens(safeData.avgPerTask)} tokens
          </span>
        </div>
      </div>
    </div>
  );
}
