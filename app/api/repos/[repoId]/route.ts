import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, repos } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ repoId: string }> },
) {
  const session = await auth();
  const { repoId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repo = await db.query.repos.findFirst({
    where: and(eq(repos.id, repoId), eq(repos.userId, session.user.id)),
  });

  if (!repo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repo = await db.query.repos.findFirst({
    where: and(eq(repos.id, repoId), eq(repos.userId, session.user.id)),
  });

  if (!repo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (typeof body.autoApprove === "boolean") {
    updates.autoApprove = body.autoApprove;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 },
    );
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repo = await db.query.repos.findFirst({
    where: and(eq(repos.id, repoId), eq(repos.userId, session.user.id)),
  });

  if (!repo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.delete(repos).where(eq(repos.id, repoId));

  return NextResponse.json({ success: true });
}
