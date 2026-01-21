"use client";

import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { format, parseISO } from "date-fns";

interface CompletionTrendChartProps {
  data: Array<{ date: string; completed: number }>;
}

export function CompletionTrendChart({ data }: CompletionTrendChartProps) {
  const chartData = data.map(d => ({
    date: format(parseISO(d.date), "MMM d"),
    completed: d.completed,
  }));

  return (
    <div className="p-6 rounded-xl border bg-card">
      <h3 className="text-sm font-serif font-medium text-muted-foreground mb-4">Completion Trend</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="completed"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ fill: "hsl(var(--primary))", r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
