import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, repos, tasks } from "@/lib/db";
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

  // Verify repo ownership
  const repo = await db.query.repos.findFirst({
    where: and(eq(repos.id, repoId), eq(repos.userId, session.user.id)),
  });

  if (!repo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const repoTasks = await db.query.tasks.findMany({
    where: eq(tasks.repoId, repoId),
    orderBy: (tasks, { asc }) => [asc(tasks.priority), asc(tasks.createdAt)],
  });

  return NextResponse.json(repoTasks);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ repoId: string }> }
) {
  const session = await auth();
  const { repoId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify repo ownership
  const repo = await db.query.repos.findFirst({
    where: and(eq(repos.id, repoId), eq(repos.userId, session.user.id)),
  });

  if (!repo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const { title, description } = body;

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const taskId = crypto.randomUUID();
  const newTask = {
    id: taskId,
    repoId,
    title,
    description: description || null,
    status: "todo" as const,
    priority: 0,
    brainstormResult: null,
    planContent: null,
    branch: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.insert(tasks).values(newTask);

  return NextResponse.json(newTask);
}
