import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, repos } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { handleError, Errors } from "@/lib/errors";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ repoId: string }> },
) {
  const session = await auth();
  const { repoId } = await params;

  if (!session?.user?.id) {
    return handleError(Errors.unauthorized());
  }

  const repo = await db.query.repos.findFirst({
    where: and(eq(repos.id, repoId), eq(repos.userId, session.user.id)),
  });

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

  const repo = await db.query.repos.findFirst({
    where: and(eq(repos.id, repoId), eq(repos.userId, session.user.id)),
  });

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

  updates.updatedAt = new Date();

  await db.update(repos).set(updates).where(eq(repos.id, repoId));

  const updatedRepo = await db.query.repos.findFirst({
    where: eq(repos.id, repoId),
  });

  return NextResponse.json(updatedRepo);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ repoId: string }> },
) {
  const session = await auth();
  const { repoId } = await params;

  if (!session?.user?.id) {
    return handleError(Errors.unauthorized());
  }

  const repo = await db.query.repos.findFirst({
    where: and(eq(repos.id, repoId), eq(repos.userId, session.user.id)),
  });

  if (!repo) {
    return handleError(Errors.notFound("Repository"));
  }

  await db.delete(repos).where(eq(repos.id, repoId));

  return NextResponse.json({ success: true });
}
