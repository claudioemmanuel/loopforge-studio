import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, repos, tasks } from "@/lib/db";
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

  // Verify repo ownership
  const repo = await db.query.repos.findFirst({
    where: and(eq(repos.id, repoId), eq(repos.userId, session.user.id)),
  });

  if (!repo) {
    return handleError(Errors.notFound("Repository"));
  }

  const repoTasks = await db.query.tasks.findMany({
    where: eq(tasks.repoId, repoId),
    orderBy: (tasks, { asc }) => [asc(tasks.priority), asc(tasks.createdAt)],
  });

  return NextResponse.json(repoTasks);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ repoId: string }> },
) {
  const session = await auth();
  const { repoId } = await params;

  if (!session?.user?.id) {
    return handleError(Errors.unauthorized());
  }

  // Verify repo ownership
  const repo = await db.query.repos.findFirst({
    where: and(eq(repos.id, repoId), eq(repos.userId, session.user.id)),
  });

  if (!repo) {
    return handleError(Errors.notFound("Repository"));
  }

  const body = await request.json();
  const { title, description, autonomousMode } = body;

  if (!title) {
    return handleError(Errors.invalidRequest("Title is required"));
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
    brainstormConversation: null,
    planContent: null,
    branch: null,
    autonomousMode: autonomousMode || false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.insert(tasks).values(newTask);

  return NextResponse.json(newTask);
}
