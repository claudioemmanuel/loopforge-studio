import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { handleError, Errors } from "@/lib/errors";
import { getRepositoryService } from "@/lib/contexts/repository/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ repoId: string }> },
) {
  const session = await auth();
  const { repoId } = await params;

  if (!session?.user?.id) {
    return handleError(Errors.unauthorized());
  }

  const repositoryService = getRepositoryService();
  const repo = await repositoryService.findByOwner(repoId, session.user.id);
  if (!repo) {
    return handleError(Errors.notFound("Repository"));
  }

  return NextResponse.json(repo);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ repoId: string }> },
) {
  const session = await auth();
  const { repoId } = await params;

  if (!session?.user?.id) {
    return handleError(Errors.unauthorized());
  }

  const repositoryService = getRepositoryService();
  const repo = await repositoryService.findByOwner(repoId, session.user.id);
  if (!repo) {
    return handleError(Errors.notFound("Repository"));
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (typeof body.autoApprove === "boolean") {
    updates.autoApprove = body.autoApprove;
  }

  if (Object.keys(updates).length === 0) {
    return handleError(Errors.invalidRequest("No valid fields to update"));
  }

  await repositoryService.updateRepository(repoId, updates);

  const updatedRepo = await repositoryService.getRepositoryFull(repoId);
  return NextResponse.json(updatedRepo);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ repoId: string }> },
) {
  const session = await auth();
  const { repoId } = await params;

  if (!session?.user?.id) {
    return handleError(Errors.unauthorized());
  }

  const repositoryService = getRepositoryService();
  const repo = await repositoryService.findByOwner(repoId, session.user.id);
  if (!repo) {
    return handleError(Errors.notFound("Repository"));
  }

  await repositoryService.deleteRepository(repoId);
  return NextResponse.json({ success: true });
}
