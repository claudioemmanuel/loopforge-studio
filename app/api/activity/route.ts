import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { db, activityEvents, repos, tasks } from "@/lib/db";
import { eq, and, desc, gte, lte, or, ilike, inArray } from "drizzle-orm";
import type { ActivityEventCategory } from "@/lib/db/schema";
import { handleError, Errors } from "@/lib/errors";

// GET - Fetch activity events with filters
export const GET = withAuth(async (request, { user }) => {
  const { searchParams } = new URL(request.url);

  // Parse query params
  const repoId = searchParams.get("repoId");
  const taskId = searchParams.get("taskId");
  const offset = parseInt(searchParams.get("offset") || "0", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
  const search = searchParams.get("search");
  const categories = searchParams.get("categories")?.split(",") as
    | ActivityEventCategory[]
    | undefined;
  const eventTypes = searchParams.get("eventTypes")?.split(",");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const since = searchParams.get("since");

  // Build query conditions
  const conditions = [eq(activityEvents.userId, user.id)];

  if (repoId) {
    // Verify repo ownership
    const repo = await db.query.repos.findFirst({
      where: and(eq(repos.id, repoId), eq(repos.userId, user.id)),
    });

    if (!repo) {
      return handleError(Errors.notFound("Repository"));
    }

    conditions.push(eq(activityEvents.repoId, repoId));
  }

  if (taskId) {
    // Verify task ownership (via repo)
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
      with: { repo: true },
    });

    if (!task || task.repo.userId !== user.id) {
      return handleError(Errors.notFound("Task"));
    }

    conditions.push(eq(activityEvents.taskId, taskId));
  }

  if (search) {
    conditions.push(
      or(
        ilike(activityEvents.title, `%${search}%`),
        ilike(activityEvents.content, `%${search}%`),
      )!,
    );
  }

  if (categories && categories.length > 0 && categories.length < 3) {
    conditions.push(inArray(activityEvents.eventCategory, categories));
  }

  if (eventTypes && eventTypes.length > 0) {
    conditions.push(inArray(activityEvents.eventType, eventTypes));
  }

  if (startDate) {
    conditions.push(gte(activityEvents.createdAt, new Date(startDate)));
  }

  if (endDate) {
    conditions.push(lte(activityEvents.createdAt, new Date(endDate)));
  }

  if (since) {
    conditions.push(gte(activityEvents.createdAt, new Date(since)));
  }

  // Execute query
  const events = await db
    .select()
    .from(activityEvents)
    .where(and(...conditions))
    .orderBy(desc(activityEvents.createdAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json({ events });
});

// POST - Create a new activity event
export const POST = withAuth(async (request, { user }) => {
  const body = await request.json();
  const {
    taskId,
    repoId,
    executionId,
    eventType,
    eventCategory,
    title,
    content,
    metadata,
  } = body;

  if (!eventType || !eventCategory || !title) {
    return handleError(
      Errors.invalidRequest("eventType, eventCategory, and title are required"),
    );
  }

  // Validate category
  if (!["ai_action", "git", "system"].includes(eventCategory)) {
    return handleError(Errors.invalidRequest("Invalid eventCategory"));
  }

  // If repoId provided, verify ownership
  if (repoId) {
    const repo = await db.query.repos.findFirst({
      where: and(eq(repos.id, repoId), eq(repos.userId, user.id)),
    });

    if (!repo) {
      return handleError(Errors.notFound("Repository"));
    }
  }

  // If taskId provided, verify ownership via repo
  if (taskId) {
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
      with: { repo: true },
    });

    if (!task || task.repo.userId !== user.id) {
      return handleError(Errors.notFound("Task"));
    }
  }

  const eventId = crypto.randomUUID();
  const newEvent = {
    id: eventId,
    taskId: taskId || null,
    repoId: repoId || null,
    userId: user.id,
    executionId: executionId || null,
    eventType,
    eventCategory: eventCategory as ActivityEventCategory,
    title,
    content: content || null,
    metadata: metadata || null,
    createdAt: new Date(),
  };

  await db.insert(activityEvents).values(newEvent);

  return NextResponse.json(newEvent);
});
