import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, pendingChanges, repos, tasks } from "@/lib/db";
import { eq, and, desc, inArray } from "drizzle-orm";

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const repoId = searchParams.get("repoId");

  if (!repoId) {
    return NextResponse.json({ error: "repoId is required" }, { status: 400 });
  }

  // Verify repo ownership
  const repo = await db.query.repos.findFirst({
    where: and(eq(repos.id, repoId), eq(repos.userId, session.user.id)),
  });

  if (!repo) {
    return NextResponse.json({ error: "Repo not found" }, { status: 404 });
  }

  // Get all tasks for this repo
  const repoTasks = await db.query.tasks.findMany({
    where: eq(tasks.repoId, repoId),
    columns: { id: true, title: true },
  });

  if (repoTasks.length === 0) {
    return NextResponse.json({ changes: [] });
  }

  const taskIds = repoTasks.map((t) => t.id);
  const taskMap = new Map(repoTasks.map((t) => [t.id, t]));

  // Get pending changes for these tasks
  const changes = await db
    .select({
      id: pendingChanges.id,
      taskId: pendingChanges.taskId,
      filePath: pendingChanges.filePath,
      action: pendingChanges.action,
      isApproved: pendingChanges.isApproved,
      createdAt: pendingChanges.createdAt,
    })
    .from(pendingChanges)
    .where(inArray(pendingChanges.taskId, taskIds))
    .orderBy(desc(pendingChanges.createdAt));

  // Enrich with task info
  const enrichedChanges = changes.map((change) => ({
    ...change,
    task: taskMap.get(change.taskId) || { id: change.taskId, title: "Unknown" },
  }));

  return NextResponse.json({ changes: enrichedChanges });
}
