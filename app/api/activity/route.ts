import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { handleError, Errors } from "@/lib/errors";
import { getAnalyticsService } from "@/lib/contexts/analytics/api";
import { getRepositoryService } from "@/lib/contexts/repository/api";

/**
 * GET /api/activity
 * Fetches recent activity events for a repository
 */
export const GET = withAuth(async (request, { user }) => {
  const { searchParams } = new URL(request.url);
  const repoId = searchParams.get("repoId");
  const limit = parseInt(searchParams.get("limit") || "50");

  if (!repoId) {
    return handleError(Errors.invalidRequest("repoId is required"));
  }

  const repositoryService = getRepositoryService();
  const repo = await repositoryService.findByOwner(repoId, user.id);
  if (!repo) {
    return handleError(Errors.notFound("Repository"));
  }

  const analyticsService = getAnalyticsService();
  const events = await analyticsService.getActivityFeed(repoId, limit);

  return NextResponse.json({ events, total: events.length });
});
