import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { getAnalyticsService } from "@/lib/contexts/analytics/api";

export const GET = withAuth(async (request, { user }) => {
  const searchParams = new URL(request.url).searchParams;
  const range = searchParams.get("range") || "week";

  let start: Date;
  const end = endOfDay(new Date());

  switch (range) {
    case "today":
      start = startOfDay(new Date());
      break;
    case "week":
      start = startOfDay(subDays(new Date(), 7));
      break;
    case "month":
      start = startOfDay(subDays(new Date(), 30));
      break;
    case "year":
      start = startOfDay(subDays(new Date(), 365));
      break;
    default:
      start = startOfDay(subDays(new Date(), 7));
  }

  const dateRange = { start, end };
  const analyticsService = getAnalyticsService();

  const [
    taskMetrics,
    tasksByStatus,
    dailyCompletions,
    repoActivity,
    tokenUsage,
    costBreakdown,
  ] = await Promise.all([
    analyticsService.getTaskMetrics(user.id, dateRange),
    analyticsService.getTasksByStatus(user.id, dateRange),
    analyticsService.getDailyCompletions(user.id, dateRange),
    analyticsService.getRepoActivity(user.id, dateRange),
    analyticsService.getTokenUsage(user.id, dateRange),
    analyticsService.getCostBreakdown(user.id, dateRange),
  ]);

  return NextResponse.json({
    taskMetrics,
    tasksByStatus,
    dailyCompletions,
    repoActivity,
    tokenUsage,
    costBreakdown,
    dateRange: { start: start.toISOString(), end: end.toISOString() },
  });
});
