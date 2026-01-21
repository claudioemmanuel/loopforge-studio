"use client";

import { useState, useEffect } from "react";
import { StatCard } from "@/components/dashboard";
import {
  TasksByStatusChart,
  CompletionTrendChart,
  TokenUsageChart,
  CostBreakdown,
  RepoActivityTable,
} from "@/components/analytics";
import { Button } from "@/components/ui/button";
import { ListTodo, CheckCircle2, TrendingUp, Clock, Download } from "lucide-react";

type DateRange = "today" | "week" | "month" | "year";

interface AnalyticsData {
  taskMetrics: {
    total: number;
    completed: number;
    executing: number;
    stuck: number;
    successRate: number;
    avgCompletionTimeMinutes: number | null;
  };
  tasksByStatus: Array<{ status: string; count: number }>;
  dailyCompletions: Array<{ date: string; completed: number }>;
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    avgPerTask: number;
  };
  costBreakdown: {
    totalCents: number;
    inputCostCents: number;
    outputCostCents: number;
    avgPerTaskCents: number;
  };
  repoActivity: Array<{
    repoId: string;
    repoName: string;
    commits: number;
    tasksCompleted: number;
  }>;
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<DateRange>("week");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);
      try {
        const res = await fetch(`/api/analytics?range=${range}`);
        if (res.ok) {
          setData(await res.json());
        }
      } catch (error) {
        console.error("Failed to fetch analytics:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, [range]);

  const handleExport = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `loopforge-analytics-${range}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Failed to load analytics.</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            Track your <em className="font-serif">AI-powered</em> development metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border rounded-lg overflow-hidden">
            {(["today", "week", "month", "year"] as DateRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-sm capitalize transition-all duration-200 ${
                  range === r
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted/50"
                }`}
              >
                {r === "today" ? "Today" : `This ${r}`}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Task Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Total Tasks"
          value={data.taskMetrics.total}
          icon={ListTodo}
        />
        <StatCard
          title="Completed"
          value={data.taskMetrics.completed}
          icon={CheckCircle2}
        />
        <StatCard
          title="Success Rate"
          value={`${data.taskMetrics.successRate}%`}
          icon={TrendingUp}
        />
        <StatCard
          title="Avg Time"
          value={data.taskMetrics.avgCompletionTimeMinutes
            ? `${data.taskMetrics.avgCompletionTimeMinutes}min`
            : "N/A"}
          icon={Clock}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-4 md:grid-cols-2 mb-8">
        <TasksByStatusChart data={data.tasksByStatus} />
        <CompletionTrendChart data={data.dailyCompletions} />
      </div>

      {/* AI Usage Section */}
      <h2 className="text-xl font-serif font-semibold tracking-tight mb-4">AI Usage</h2>
      <div className="grid gap-4 md:grid-cols-2 mb-8">
        <TokenUsageChart data={data.tokenUsage} />
        <CostBreakdown data={data.costBreakdown} />
      </div>

      {/* Repository Activity */}
      <h2 className="text-xl font-serif font-semibold tracking-tight mb-4">Repository Activity</h2>
      <RepoActivityTable data={data.repoActivity} />
    </div>
  );
}
