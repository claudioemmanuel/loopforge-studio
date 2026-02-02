/**
 * POST /api/tasks/[taskId]/brainstorm
 *
 * TODO (DDD Migration): This handler uses atomic DB operations for race condition prevention.
 * Proper migration requires:
 * 1. Create TaskService.startBrainstorm(taskId, userId) method
 * 2. Implement atomic processing slot claiming in domain layer
 * 3. Move AI brainstorm orchestration to Application Service
 * 4. Use taskService.updateBrainstormResult() for saving results
 * 5. Ensure atomic state verification remains intact
 *
 * Current critical operations:
 * - Atomic claim: Prevents concurrent brainstorm requests (lines 24-38)
 * - State verification: Discards result if task state changed (lines 56-70)
 * - Error reversion: Reverts to "todo" on AI errors (lines 96-104)
 */
import { NextResponse } from "next/server";
import { db, tasks } from "@/lib/db";
import { eq, and, isNull } from "drizzle-orm";
import { brainstormTask, createAIClient } from "@/lib/ai";
import { handleError, Errors } from "@/lib/errors";
import { withTask, getAIClientConfig } from "@/lib/api";
import { apiLogger } from "@/lib/logger";

export const POST = withTask(async (request, { user, task, taskId }) => {
  const config = getAIClientConfig(user);
  if (!config) {
    return handleError(Errors.noProviderConfigured());
  }

  try {
    const client = await createAIClient(
      config.provider,
      config.apiKey,
      config.model,
    );

    // ATOMIC: Claim the processing slot to prevent concurrent brainstorms
    // This UPDATE only succeeds if processingPhase is NULL (not already processing)
    const claimResult = await db
      .update(tasks)
      .set({
        status: "brainstorming",
        processingPhase: "brainstorming",
        processingStatusText: "Analyzing task requirements...",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tasks.id, taskId),
          isNull(tasks.processingPhase), // Only claim if not already processing
        ),
      )
      .returning();

    // If no rows were updated, another request already claimed the slot
    if (claimResult.length === 0) {
      return NextResponse.json(
        {
          error: "Task is already processing",
          phase: task.processingPhase || "unknown",
        },
        { status: 409 },
      );
    }

    // Run brainstorm
    const result = await brainstormTask(client, task.title, task.description);

    // Verify task is still in expected state before saving result
    // This prevents overwriting user's manual changes during long AI operations
    const updateResult = await db
      .update(tasks)
      .set({
        brainstormResult: JSON.stringify(result, null, 2),
        processingPhase: null, // Clear processing state
        processingStatusText: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tasks.id, taskId),
          eq(tasks.status, "brainstorming"), // Only update if still brainstorming
        ),
      )
      .returning();

    if (updateResult.length === 0) {
      apiLogger.warn(
        { taskId },
        "Task state changed during processing, discarding result",
      );
      return NextResponse.json(
        { error: "Task state changed during processing" },
        { status: 409 },
      );
    }

    return NextResponse.json(updateResult[0]);
  } catch (error) {
    apiLogger.error(
      {
        taskId,
        provider: config.provider,
        model: config.model,
        error: error instanceof Error ? error.message : String(error),
      },
      "Brainstorm error",
    );

    // Revert status and clear processing state on error
    await db
      .update(tasks)
      .set({
        status: "todo",
        processingPhase: null,
        processingStatusText: null,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    return handleError(error);
  }
});
