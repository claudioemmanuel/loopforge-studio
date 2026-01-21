import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, executions, executionEvents } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ executionId: string }> }
) {
  const session = await auth();
  const { executionId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get execution with task and repo to verify ownership
  const execution = await db.query.executions.findFirst({
    where: eq(executions.id, executionId),
    with: {
      task: {
        with: {
          repo: true,
        },
      },
    },
  });

  if (!execution || execution.task.repo.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Get events
  const events = await db.query.executionEvents.findMany({
    where: eq(executionEvents.executionId, executionId),
    orderBy: (events, { asc }) => [asc(events.createdAt)],
  });

  return NextResponse.json(
    events.map((e) => ({
      id: e.id,
      type: e.eventType,
      content: e.content,
      timestamp: e.createdAt,
    }))
  );
}
