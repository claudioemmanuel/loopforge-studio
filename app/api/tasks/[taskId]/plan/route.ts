import { NextResponse } from "next/server";
import { db, tasks } from "@/lib/db";
import { eq } from "drizzle-orm";
import { generatePlan, createAIClient } from "@/lib/ai";
import { handleError, Errors } from "@/lib/errors";
import { withTask, getAIClientConfig } from "@/lib/api";

export const POST = withTask(async (request, { user, task, taskId }) => {
  const config = getAIClientConfig(user);
  if (!config) {
    return handleError(Errors.noProviderConfigured());
  }

  try {
    const client = await createAIClient(config.provider, config.apiKey, config.model);

    // Update status to planning
    await db
      .update(tasks)
      .set({ status: "planning", updatedAt: new Date() })
      .where(eq(tasks.id, taskId));

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
      }
    );

    // Update task with result
    await db
      .update(tasks)
      .set({
        planContent: JSON.stringify(result, null, 2),
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    const updatedTask = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    });

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error("Plan generation error:", {
      taskId,
      provider: config.provider,
      model: config.model,
      error,
      timestamp: new Date().toISOString(),
    });

    // Revert status on error
    await db
      .update(tasks)
      .set({ status: "brainstorming", updatedAt: new Date() })
      .where(eq(tasks.id, taskId));

    return handleError(error);
  }
});
