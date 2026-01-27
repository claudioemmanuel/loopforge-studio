import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, activitySummaries, activityEvents, repos } from "@/lib/db";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";

// GET - Fetch daily activity summaries
export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  const repoId = searchParams.get("repoId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const limit = Math.min(parseInt(searchParams.get("limit") || "30", 10), 90);

  // Build query conditions
  const conditions = [eq(activitySummaries.userId, session.user.id)];

  if (repoId) {
    // Verify repo ownership
    const repo = await db.query.repos.findFirst({
      where: and(eq(repos.id, repoId), eq(repos.userId, session.user.id)),
    });

    if (!repo) {
      return NextResponse.json({ error: "Repo not found" }, { status: 404 });
    }

    conditions.push(eq(activitySummaries.repoId, repoId));
  }

  if (startDate) {
    conditions.push(gte(activitySummaries.date, new Date(startDate)));
  }

  if (endDate) {
    conditions.push(lte(activitySummaries.date, new Date(endDate)));
  }

  // Fetch existing summaries
  const summaries = await db
    .select()
    .from(activitySummaries)
    .where(and(...conditions))
    .orderBy(desc(activitySummaries.date))
    .limit(limit);

  // If no summaries exist, generate them from events
  if (summaries.length === 0) {
    // Get date range for the past 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    // Aggregate events by day
    const eventConditions = [
      eq(activityEvents.userId, session.user.id),
      gte(activityEvents.createdAt, thirtyDaysAgo),
    ];

    if (repoId) {
      eventConditions.push(eq(activityEvents.repoId, repoId));
    }

    const events = await db
      .select()
      .from(activityEvents)
      .where(and(...eventConditions))
      .orderBy(desc(activityEvents.createdAt));

    // Group events by day and calculate stats
    const dayStats = new Map<
      string,
      {
        date: Date;
        tasksCompleted: number;
        tasksFailed: number;
        commits: number;
        filesChanged: Set<string>;
        tokensUsed: number;
      }
    >();

    for (const event of events) {
      const dayKey = new Date(event.createdAt).toDateString();

      if (!dayStats.has(dayKey)) {
        const dayStart = new Date(event.createdAt);
        dayStart.setHours(0, 0, 0, 0);

        dayStats.set(dayKey, {
          date: dayStart,
          tasksCompleted: 0,
          tasksFailed: 0,
          commits: 0,
          filesChanged: new Set(),
          tokensUsed: 0,
        });
      }

      const stats = dayStats.get(dayKey)!;

      switch (event.eventType) {
        case "task_completed":
        case "complete":
          stats.tasksCompleted++;
          break;
        case "task_failed":
        case "error":
        case "stuck":
          stats.tasksFailed++;
          break;
        case "commit":
          stats.commits++;
          break;
        case "file_write":
          if (event.metadata?.filePath) {
            stats.filesChanged.add(event.metadata.filePath as string);
          }
          break;
      }
    }

    // Convert to summary format
    const generatedSummaries = Array.from(dayStats.values())
      .map((stats) => ({
        id: crypto.randomUUID(),
        userId: session.user.id,
        repoId: repoId || null,
        date: stats.date,
        tasksCompleted: stats.tasksCompleted,
        tasksFailed: stats.tasksFailed,
        commits: stats.commits,
        filesChanged: stats.filesChanged.size,
        tokensUsed: stats.tokensUsed,
        summaryText: null,
        createdAt: new Date(),
      }))
      .filter(
        (s) =>
          s.tasksCompleted > 0 ||
          s.tasksFailed > 0 ||
          s.commits > 0 ||
          s.filesChanged > 0,
      );

    return NextResponse.json({ summaries: generatedSummaries });
  }

  return NextResponse.json({ summaries });
}

// POST - Generate or update a daily summary
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { repoId, date } = body;

  if (!date) {
    return NextResponse.json({ error: "date is required" }, { status: 400 });
  }

  // Verify repo ownership if provided
  if (repoId) {
    const repo = await db.query.repos.findFirst({
      where: and(eq(repos.id, repoId), eq(repos.userId, session.user.id)),
    });

    if (!repo) {
      return NextResponse.json({ error: "Repo not found" }, { status: 404 });
    }
  }

  // Get day boundaries
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);

  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  // Aggregate events for the day
  const eventConditions = [
    eq(activityEvents.userId, session.user.id),
    gte(activityEvents.createdAt, dayStart),
    lte(activityEvents.createdAt, dayEnd),
  ];

  if (repoId) {
    eventConditions.push(eq(activityEvents.repoId, repoId));
  }

  const events = await db
    .select()
    .from(activityEvents)
    .where(and(...eventConditions));

  // Calculate stats
  let tasksCompleted = 0;
  let tasksFailed = 0;
  let commits = 0;
  const filesChanged = new Set<string>();
  const tokensUsed = 0; // TODO: calculate from token tracking when available

  for (const event of events) {
    switch (event.eventType) {
      case "task_completed":
      case "complete":
        tasksCompleted++;
        break;
      case "task_failed":
      case "error":
      case "stuck":
        tasksFailed++;
        break;
      case "commit":
        commits++;
        break;
      case "file_write":
        if (event.metadata?.filePath) {
          filesChanged.add(event.metadata.filePath as string);
        }
        break;
    }
  }

  const summaryId = crypto.randomUUID();
  const summary = {
    id: summaryId,
    userId: session.user.id,
    repoId: repoId || null,
    date: dayStart,
    tasksCompleted,
    tasksFailed,
    commits,
    filesChanged: filesChanged.size,
    tokensUsed,
    summaryText: null,
    createdAt: new Date(),
  };

  // Upsert the summary
  await db
    .insert(activitySummaries)
    .values(summary)
    .onConflictDoUpdate({
      target: [activitySummaries.userId, activitySummaries.date],
      set: {
        tasksCompleted: summary.tasksCompleted,
        tasksFailed: summary.tasksFailed,
        commits: summary.commits,
        filesChanged: summary.filesChanged,
        tokensUsed: summary.tokensUsed,
      },
    });

  return NextResponse.json(summary);
}
