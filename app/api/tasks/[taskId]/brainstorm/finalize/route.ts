import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, tasks } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getConversation, deleteConversation } from "@/lib/ai";
import { apiLogger } from "@/lib/logger";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const session = await auth();
  const { taskId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get task with repo to verify ownership
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: { repo: true },
  });

  if (!task || task.repo.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Get conversation
  const conversation = getConversation(taskId);
  if (!conversation || !conversation.currentPreview) {
    return NextResponse.json(
      { error: "No brainstorm result to finalize" },
      { status: 400 },
    );
  }

  try {
    // Save final brainstorm result
    const brainstormResult = conversation.currentPreview;

    await db
      .update(tasks)
      .set({
        brainstormResult: JSON.stringify(brainstormResult, null, 2),
        brainstormConversation: null, // Clear conversation on finalize
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    // Delete conversation from memory
    deleteConversation(taskId);

    // Get updated task
    const updatedTask = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    });

    return NextResponse.json(updatedTask);
  } catch (error) {
    apiLogger.error({ taskId, error }, "Brainstorm finalize error");
    return NextResponse.json(
      { error: "Failed to finalize brainstorm. Please try again." },
      { status: 500 },
    );
  }
}
