import { NextResponse } from "next/server";
import { getConversation, deleteConversation } from "@/lib/ai";
import { withTask } from "@/lib/api";
import { UseCaseFactory } from "@/lib/contexts/task/api/use-case-factory";
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
    const saveBrainstormUseCase = UseCaseFactory.saveBrainstormResult();
    const brainstormResult = {
      summary: JSON.stringify(conversation.currentPreview, null, 2),
      conversation: [],
      messageCount: 0,
      compactedAt: null,
    };

    await saveBrainstormUseCase.execute({
      taskId,
      result: brainstormResult,
    });

    // Transition to planning phase
    const finalizeUseCase = UseCaseFactory.finalizeBrainstorm();
    const result = await finalizeUseCase.execute({ taskId });

    if (result.isFailure) {
      apiLogger.error(
        { taskId, error: result.error },
        "Finalize brainstorm failed",
      );
      return NextResponse.json(
        { error: "Failed to finalize brainstorm. Please try again." },
        { status: 500 },
      );
    }

    // Delete conversation from memory
    deleteConversation(taskId);

    // Fetch updated task
    const getTaskUseCase = UseCaseFactory.getTaskWithRepo();
    const taskResult = await getTaskUseCase.execute({ taskId });

    return NextResponse.json(
      taskResult.isSuccess ? taskResult.value : result.value,
    );
  } catch (error) {
    apiLogger.error({ taskId, error }, "Brainstorm finalize error");
    return NextResponse.json(
      { error: "Failed to finalize brainstorm. Please try again." },
      { status: 500 },
    );
  }
});
