import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { handleError, Errors } from "@/lib/errors";
import { getAnalyticsService } from "@/lib/contexts/analytics/api";
import { getRepositoryService } from "@/lib/contexts/repository/api";

/**
 * GET /api/activity/summary
 * Fetches activity summary statistics for a repository
 */
export const GET = withAuth(async (request, { user }) => {
  const { searchParams } = new URL(request.url);
  const repoId = searchParams.get("repoId");
  const days = parseInt(searchParams.get("days") || "7");

  if (!repoId) {
    return handleError(Errors.invalidRequest("repoId is required"));
  }

  const repositoryService = getRepositoryService();
  const repo = await repositoryService.findByOwner(repoId, user.id);
  if (!repo) {
    return handleError(Errors.notFound("Repository"));
  }

  const analyticsService = getAnalyticsService();
  const summary = await analyticsService.getActivitySummary(repoId, days);

  return NextResponse.json(summary);
});
