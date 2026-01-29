import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { subDays, startOfDay, endOfDay } from "date-fns";
import {
  getTaskMetrics,
  getTasksByStatus,
  getDailyCompletions,
  getRepoActivity,
  getTokenUsage,
  getCostBreakdown,
} from "@/lib/api/analytics";

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

  const [
    taskMetrics,
    tasksByStatus,
    dailyCompletions,
    repoActivity,
    tokenUsage,
    costBreakdown,
  ] = await Promise.all([
    getTaskMetrics(user.id, dateRange),
    getTasksByStatus(user.id, dateRange),
    getDailyCompletions(user.id, dateRange),
    getRepoActivity(user.id, dateRange),
    getTokenUsage(user.id, dateRange),
    getCostBreakdown(user.id, dateRange),
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
