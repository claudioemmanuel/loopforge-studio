"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { clientLogger } from "@/lib/logger";
import { StatCard } from "@/components/dashboard";
import { Button } from "@/components/ui/button";

const TasksByStatusChart = dynamic(
  () => import("@/components/analytics").then((mod) => mod.TasksByStatusChart),
  { ssr: false },
);

const CompletionTrendChart = dynamic(
  () =>
    import("@/components/analytics").then((mod) => mod.CompletionTrendChart),
  { ssr: false },
);

const TokenUsageChart = dynamic(
  () => import("@/components/analytics").then((mod) => mod.TokenUsageChart),
  { ssr: false },
);

const CostBreakdown = dynamic(
  () => import("@/components/analytics").then((mod) => mod.CostBreakdown),
  { ssr: false },
);

const RepoActivityTable = dynamic(
  () => import("@/components/analytics").then((mod) => mod.RepoActivityTable),
  { ssr: false },
);
import {
  ListTodo,
  CheckCircle2,
  TrendingUp,
  Clock,
  Download,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

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
  const t = useTranslations("execution.performance");
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
        clientLogger.error("Failed to fetch analytics", { error });
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, [range]);

  const handleExport = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
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

  const hasData = data.taskMetrics.total > 0;

  if (!hasData) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-primary" />
              {t("title")}
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              {t("subtitle")}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-6">
            <BarChart3 className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-serif font-semibold mb-2">
            {t("noData")}
          </h2>
          <p className="text-muted-foreground max-w-md mb-6">
            {t("noDataMessage")}
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            {t("goToDashboard")}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-primary" />
            {t("title")}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex border rounded-lg overflow-hidden overflow-x-auto">
            {(["today", "week", "month", "year"] as DateRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-2 sm:px-3 py-1.5 text-sm capitalize transition-all duration-200 whitespace-nowrap ${
                  range === r
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted/50"
                }`}
              >
                {t(`dateRanges.${r}`)}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="w-full sm:w-auto"
          >
            <Download className="w-4 h-4 mr-2" />
            {t("export")}
          </Button>
        </div>
      </div>

      {/* Task Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title={t("stats.totalTasks")}
          value={data.taskMetrics.total}
          icon={ListTodo}
        />
        <StatCard
          title={t("stats.completed")}
          value={data.taskMetrics.completed}
          icon={CheckCircle2}
        />
        <StatCard
          title={t("stats.successRate")}
          value={`${data.taskMetrics.successRate}%`}
          icon={TrendingUp}
        />
        <StatCard
          title={t("stats.avgTime")}
          value={
            data.taskMetrics.avgCompletionTimeMinutes
              ? `${data.taskMetrics.avgCompletionTimeMinutes}min`
              : "N/A"
          }
          icon={Clock}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-4 md:grid-cols-2 mb-8">
        <TasksByStatusChart data={data.tasksByStatus} />
        <CompletionTrendChart data={data.dailyCompletions} />
      </div>

      {/* AI Usage Section */}
      <h2 className="text-xl font-serif font-semibold tracking-tight mb-4">
        {t("sections.aiUsage")}
      </h2>
      <div className="grid gap-4 md:grid-cols-2 mb-8">
        <TokenUsageChart data={data.tokenUsage} />
        <CostBreakdown data={data.costBreakdown} />
      </div>

      {/* Repository Activity */}
      <h2 className="text-xl font-serif font-semibold tracking-tight mb-4">
        {t("sections.repoActivity")}
      </h2>
      <RepoActivityTable data={data.repoActivity} />
    </div>
  );
}
