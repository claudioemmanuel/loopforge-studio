import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db, repos, tasks } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { handleError, Errors } from "@/lib/errors";
import {
  checkTaskLimit,
  formatLimitError,
} from "@/lib/api/subscription-limits";
import { createTaskCreatedEvent } from "@/lib/activity";

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

  // Validate request body
  const bodySchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    autonomousMode: z.boolean().optional().default(false),
    autoApprove: z.boolean().optional().default(false),
  });

  let validatedBody;
  try {
    validatedBody = bodySchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleError(
        Errors.invalidRequest(
          error.errors[0]?.message || "Invalid request body",
        ),
      );
    }
    return handleError(Errors.invalidRequest("Invalid request body"));
  }

  const { title, description, autonomousMode, autoApprove } = validatedBody;

  // Check subscription limits (Phase 3.2)
  const limitCheck = await checkTaskLimit(session.user.id, repoId);
  if (!limitCheck.allowed) {
    return NextResponse.json(formatLimitError(limitCheck, "task"), {
      status: 402,
    });
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
    autonomousMode,
    autoApprove,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.insert(tasks).values(newTask);

  // Create activity event for task creation
  await createTaskCreatedEvent({
    taskId,
    repoId,
    userId: session.user.id,
    taskTitle: title,
  });

  return NextResponse.json(newTask);
}
