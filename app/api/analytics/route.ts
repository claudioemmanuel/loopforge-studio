import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { subDays, startOfDay, endOfDay } from "date-fns";
import {
  getTaskMetrics,
  getTasksByStatus,
  getDailyCompletions,
  getTokenUsage,
  getCostBreakdown,
  getRepoActivity,
} from "@/lib/api/analytics";

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
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
    tokenUsage,
    costBreakdown,
    repoActivity,
  ] = await Promise.all([
    getTaskMetrics(session.user.id, dateRange),
    getTasksByStatus(session.user.id, dateRange),
    getDailyCompletions(session.user.id, dateRange),
    getTokenUsage(session.user.id, dateRange),
    getCostBreakdown(session.user.id, dateRange),
    getRepoActivity(session.user.id, dateRange),
  ]);

  return NextResponse.json({
    taskMetrics,
    tasksByStatus,
    dailyCompletions,
    tokenUsage,
    costBreakdown,
    repoActivity,
    dateRange: { start: start.toISOString(), end: end.toISOString() },
  });
}
