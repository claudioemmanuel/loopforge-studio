import { NextResponse } from "next/server";
import { db, tasks } from "@/lib/db";
import { eq, and, isNull } from "drizzle-orm";
import { generatePlan, createAIClient } from "@/lib/ai";
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

    // ATOMIC: Claim the processing slot to prevent concurrent plans
    // This UPDATE only succeeds if processingPhase is NULL (not already processing)
    const claimResult = await db
      .update(tasks)
      .set({
        status: "planning",
        processingPhase: "planning",
        processingStatusText: "Generating execution plan...",
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

    // Generate plan with repo context
    const result = await generatePlan(
      client,
      task.title,
      task.description,
      task.brainstormResult,
      {
        name: task.repo.name,
        fullName: task.repo.fullName,
        defaultBranch: task.repo.defaultBranch || "main",
      },
    );

    // Update task with result and clear processing state
    const [updatedTask] = await db
      .update(tasks)
      .set({
        planContent: JSON.stringify(result, null, 2),
        processingPhase: null, // Clear processing state
        processingStatusText: null,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId))
      .returning();

    return NextResponse.json(updatedTask);
  } catch (error) {
    apiLogger.error(
      {
        taskId,
        provider: config.provider,
        model: config.model,
        error,
      },
      "Plan generation error",
    );

    // Revert status and clear processing state on error
    await db
      .update(tasks)
      .set({
        status: "brainstorming",
        processingPhase: null,
        processingStatusText: null,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    return handleError(error);
  }
});
