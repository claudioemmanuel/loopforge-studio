import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { handleError, Errors } from "@/lib/errors";
import { getAnalyticsService } from "@/lib/contexts/analytics/api";
import { getRepositoryService } from "@/lib/contexts/repository/api";

/**
 * GET /api/activity/changes
 * Fetches git-category activity events (commits / file changes)
 */
export const GET = withAuth(async (request, { user }) => {
  const { searchParams } = new URL(request.url);
  const repoId = searchParams.get("repoId");
  const limit = parseInt(searchParams.get("limit") || "20");

  if (!repoId) {
    return handleError(Errors.invalidRequest("repoId is required"));
  }

  const repositoryService = getRepositoryService();
  const repo = await repositoryService.findByOwner(repoId, user.id);
  if (!repo) {
    return handleError(Errors.notFound("Repository"));
  }

  const analyticsService = getAnalyticsService();
  const changes = await analyticsService.getActivityChanges(repoId, limit);

  return NextResponse.json({ changes, total: changes.length });
});
