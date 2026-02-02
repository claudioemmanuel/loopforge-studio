import { NextResponse } from "next/server";
import { getConversation, deleteConversation } from "@/lib/ai";
import { withTask } from "@/lib/api";
import { apiLogger } from "@/lib/logger";
import { getTaskService } from "@/lib/contexts/task/api";

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

    // Save final brainstorm result using service
    const brainstormResult = conversation.currentPreview;

    await taskService.updateBrainstormResult(taskId, {
      summary: JSON.stringify(brainstormResult, null, 2),
      conversation: [], // Clear conversation on finalize
      suggestComplete: true, // Finalize marks brainstorm as complete
    });

    // Delete conversation from memory
    deleteConversation(taskId);

    // Get updated task using service
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
