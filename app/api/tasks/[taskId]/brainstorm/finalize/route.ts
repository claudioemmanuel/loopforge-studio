import { NextResponse } from "next/server";
import { getConversation, deleteConversation } from "@/lib/ai";
import { withTask } from "@/lib/api";
import { getTaskService } from "@/lib/contexts/task/api";
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
    const taskService = getTaskService();

    // Save final brainstorm result and clear conversation
    await taskService.updateFields(taskId, {
      brainstormResult: JSON.stringify(conversation.currentPreview, null, 2),
      brainstormConversation: null,
    });

    // Delete conversation from memory
    deleteConversation(taskId);

    const updatedTask = await taskService.getTaskFull(taskId);
    return NextResponse.json(updatedTask);
  } catch (error) {
    apiLogger.error({ taskId, error }, "Brainstorm finalize error");
    return NextResponse.json(
      { error: "Failed to finalize brainstorm. Please try again." },
      { status: 500 },
    );
  }
});
