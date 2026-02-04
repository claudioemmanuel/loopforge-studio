import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db, repos, tasks } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { handleError, Errors } from "@/lib/errors";
import {
  getBillingService,
  formatLimitError,
} from "@/lib/contexts/billing/api";
import { getAnalyticsService } from "@/lib/contexts/analytics/api";
import { getTaskService } from "@/lib/contexts/task/api";

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

  // Check subscription limits
  const billingService = getBillingService();
  const limitCheck = await billingService.checkTaskLimit(
    session.user.id,
    repoId,
  );
  if (!limitCheck.allowed) {
    return NextResponse.json(formatLimitError(limitCheck, "task"), {
      status: 402,
    });
  }

  const taskService = getTaskService();
  const newTask = await taskService.createTask({
    repoId,
    title,
    description: description || null,
    autonomousMode,
    autoApprove,
  });
  const taskId = newTask.id;

  // Record activity event
  const analyticsService = getAnalyticsService();
  await analyticsService.taskCreated({
    taskId,
    repoId,
    userId: session.user.id,
    taskTitle: title,
  });

  return NextResponse.json(newTask);
}
