"use client";

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";

interface TasksByStatusChartProps {
  data: Array<{ status: string; count: number }>;
}

const statusColors: Record<string, string> = {
  done: "#22c55e",
  executing: "#3b82f6",
  ready: "#8b5cf6",
  planning: "#f59e0b",
  brainstorming: "#06b6d4",
  todo: "#6b7280",
  stuck: "#ef4444",
};

const statusLabels: Record<string, string> = {
  done: "Done",
  executing: "Executing",
  ready: "Ready",
  planning: "Planning",
  brainstorming: "Brainstorm",
  todo: "Todo",
  stuck: "Stuck",
};

export function TasksByStatusChart({ data }: TasksByStatusChartProps) {
  const chartData = data.map(d => ({
    name: statusLabels[d.status] || d.status,
    value: d.count,
    status: d.status,
  }));

  return (
    <div className="p-6 rounded-xl border bg-card">
      <h3 className="text-sm font-serif font-medium text-muted-foreground mb-4">Tasks by Status</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical">
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={statusColors[entry.status] || "#6b7280"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
