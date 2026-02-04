import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { getRepositoryService } from "@/lib/contexts/repository/api";

export const GET = withAuth(async (_request, { user }) => {
  const repositoryService = getRepositoryService();
  const userRepos = await repositoryService.listUserRepositories(user.id);
  return NextResponse.json(userRepos);
});

export const DELETE = withAuth(async (_request, { user }) => {
  const repositoryService = getRepositoryService();
  await repositoryService.deleteAllByUser(user.id);
  return NextResponse.json({ success: true });
});
