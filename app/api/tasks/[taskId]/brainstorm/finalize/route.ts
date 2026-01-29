import { NextResponse } from "next/server";
import { db, tasks } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getConversation, deleteConversation } from "@/lib/ai";
import { withTask } from "@/lib/api";
import { apiLogger } from "@/lib/logger";

export const POST = withTask(async (request, { taskId }) => {
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
});
