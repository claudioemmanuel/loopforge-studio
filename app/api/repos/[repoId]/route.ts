import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, repos } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ repoId: string }> }
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ repoId: string }> }
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
