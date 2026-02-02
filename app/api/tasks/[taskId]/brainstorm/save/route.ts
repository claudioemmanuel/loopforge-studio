import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, tasks } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getConversation } from "@/lib/ai";
import { apiLogger } from "@/lib/logger";
import { handleError, Errors } from "@/lib/errors";
import { getTaskService } from "@/lib/contexts/task/api";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const session = await auth();
  const { taskId } = await params;

  if (!session?.user?.id) {
    return handleError(Errors.unauthorized());
  }

  // Get task with repo to verify ownership
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: { repo: true },
  });

  if (!task || task.repo.userId !== session.user.id) {
    return handleError(Errors.notFound("Task"));
  }

  // Get conversation from memory
  const conversation = getConversation(taskId);

  // If no conversation in memory, nothing to save
  if (!conversation) {
    return NextResponse.json({ success: true, saved: false });
  }

  try {
    const taskService = getTaskService();

    // Save brainstorm result using service
    if (conversation.currentPreview || conversation.messages.length > 0) {
      await taskService.updateBrainstormResult(taskId, {
        conversation: conversation.messages,
        summary: conversation.currentPreview
          ? JSON.stringify(conversation.currentPreview, null, 2)
          : undefined,
        suggestComplete: false, // Save doesn't mean brainstorm is complete
      });
    }

    // Keep conversation in memory (don't delete)
    // This allows continuing the conversation if user reopens

    // Get updated task using service
    const updatedTask = await taskService.getTaskFull(taskId);

    return NextResponse.json({
      success: true,
      saved: true,
      task: updatedTask,
    });
  } catch (error) {
    apiLogger.error({ taskId, error }, "Brainstorm save error");
    return handleError(error);
  }
}
