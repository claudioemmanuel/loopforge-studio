import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, activityEvents, repos, tasks, users } from "@/lib/db";
import { eq, and, desc, sql, gte, lte, or, ilike, inArray } from "drizzle-orm";
import type { ActivityEventCategory } from "@/lib/db/schema";

// GET - Fetch activity events with filters
export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
  const conditions = [eq(activityEvents.userId, session.user.id)];

  if (repoId) {
    // Verify repo ownership
    const repo = await db.query.repos.findFirst({
      where: and(eq(repos.id, repoId), eq(repos.userId, session.user.id)),
    });

    if (!repo) {
      return NextResponse.json({ error: "Repo not found" }, { status: 404 });
    }

    conditions.push(eq(activityEvents.repoId, repoId));
  }

  if (taskId) {
    // Verify task ownership (via repo)
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
      with: { repo: true },
    });

    if (!task || task.repo.userId !== session.user.id) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
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
}

// POST - Create a new activity event
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    return NextResponse.json(
      { error: "eventType, eventCategory, and title are required" },
      { status: 400 },
    );
  }

  // Validate category
  if (!["ai_action", "git", "system"].includes(eventCategory)) {
    return NextResponse.json(
      { error: "Invalid eventCategory" },
      { status: 400 },
    );
  }

  // If repoId provided, verify ownership
  if (repoId) {
    const repo = await db.query.repos.findFirst({
      where: and(eq(repos.id, repoId), eq(repos.userId, session.user.id)),
    });

    if (!repo) {
      return NextResponse.json({ error: "Repo not found" }, { status: 404 });
    }
  }

  // If taskId provided, verify ownership via repo
  if (taskId) {
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
      with: { repo: true },
    });

    if (!task || task.repo.userId !== session.user.id) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
  }

  const eventId = crypto.randomUUID();
  const newEvent = {
    id: eventId,
    taskId: taskId || null,
    repoId: repoId || null,
    userId: session.user.id,
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
}
