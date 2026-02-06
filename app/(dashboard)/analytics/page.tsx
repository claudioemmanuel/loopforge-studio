import { redirect } from "next/navigation";
import { startOfDay, endOfDay, subDays } from "date-fns";
import { auth } from "@/lib/auth";
import { getAnalyticsService } from "@/lib/contexts/analytics/api";
import AnalyticsPageClient, {
  type AnalyticsData,
} from "./analytics-page-client";

type DateRange = "today" | "week" | "month" | "year";

function getDateRange(range: DateRange): { start: Date; end: Date } {
  const end = endOfDay(new Date());

  switch (range) {
    case "today":
      return { start: startOfDay(new Date()), end };
    case "month":
      return { start: startOfDay(subDays(new Date(), 30)), end };
    case "year":
      return { start: startOfDay(subDays(new Date(), 365)), end };
    case "week":
    default:
      return { start: startOfDay(subDays(new Date(), 7)), end };
  }
}

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const initialRange: DateRange = "week";
  const analyticsService = getAnalyticsService();
  const dateRange = getDateRange(initialRange);

  let initialData: AnalyticsData | null = null;

  try {
    const [
      taskMetrics,
      tasksByStatus,
      dailyCompletions,
      repoActivity,
      rawTokenUsage,
      rawCostBreakdown,
    ] = await Promise.all([
      analyticsService.getTaskMetrics(session.user.id, dateRange),
      analyticsService.getTasksByStatus(session.user.id, dateRange),
      analyticsService.getDailyCompletions(session.user.id, dateRange),
      analyticsService.getRepoActivity(session.user.id, dateRange),
      analyticsService.getTokenUsage(session.user.id, dateRange),
      analyticsService.getCostBreakdown(session.user.id, dateRange),
    ]);

    const denominator = Math.max(taskMetrics.completed || taskMetrics.total, 1);
    const tokenUsage = {
      inputTokens: rawTokenUsage.inputTokens,
      outputTokens: rawTokenUsage.outputTokens,
      totalTokens: rawTokenUsage.totalTokens,
      avgPerTask: Math.round(rawTokenUsage.totalTokens / denominator),
    };

    const totalCents = rawCostBreakdown.total.estimatedCostCents;
    const costBreakdown = {
      totalCents,
      inputCostCents: totalCents,
      outputCostCents: 0,
      avgPerTaskCents: Math.round(totalCents / denominator),
    };

    initialData = {
      taskMetrics,
      tasksByStatus,
      dailyCompletions,
      repoActivity,
      tokenUsage,
      costBreakdown,
    };
  } catch (error) {
    console.error("Failed to preload analytics data:", error);
  }

  return (
    <AnalyticsPageClient
      initialRange={initialRange}
      initialData={initialData}
    />
  );
}
