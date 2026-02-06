import { NextResponse } from "next/server";
import { getConversation } from "@/lib/ai";
import { apiLogger } from "@/lib/logger";
import { handleError } from "@/lib/errors";
import { UseCaseFactory } from "@/lib/contexts/task/api/use-case-factory";
import { withTask } from "@/lib/api";

export const POST = withTask(async (request, { taskId }) => {
  // Get conversation from memory
  const conversation = getConversation(taskId);

  // If no conversation in memory, nothing to save
  if (!conversation) {
    return NextResponse.json({ success: true, saved: false });
  }

  try {
    // Prepare brainstorm result in the format expected by use case
    const brainstormResult = {
      summary: conversation.currentPreview
        ? JSON.stringify(conversation.currentPreview)
        : "No summary available",
      conversation: (conversation.messages || []).map((message) => ({
        role: (message.role === "user" ? "user" : "assistant") as
          | "user"
          | "assistant",
        content: message.content,
        timestamp: new Date(),
      })),
      messageCount: conversation.messages?.length || 0,
      compactedAt: null,
    };

    // Save via use case
    const useCase = UseCaseFactory.saveBrainstormResult();
    const result = await useCase.execute({
      taskId,
      result: brainstormResult,
    });

    if (result.isFailure) {
      return handleError(result.error);
    }

    // Keep conversation in memory (don't delete)
    // This allows continuing the conversation if user reopens

    return NextResponse.json({
      success: true,
      saved: true,
    });
  } catch (error) {
    apiLogger.error({ taskId, error }, "Brainstorm save error");
    return handleError(error);
  }
});
