import { NextResponse } from "next/server";
import { db, tasks } from "@/lib/db";
import { eq } from "drizzle-orm";
import { brainstormTask, createAIClient } from "@/lib/ai";
import { handleError, Errors } from "@/lib/errors";
import { withTask, getAIClientConfig } from "@/lib/api";

export const POST = withTask(async (request, { user, task, taskId }) => {
  const config = getAIClientConfig(user);
  if (!config) {
    return handleError(Errors.noProviderConfigured());
  }

  try {
    const client = await createAIClient(config.provider, config.apiKey, config.model);

    // Update status to brainstorming
    await db
      .update(tasks)
      .set({ status: "brainstorming", updatedAt: new Date() })
      .where(eq(tasks.id, taskId));

    // Run brainstorm
    const result = await brainstormTask(client, task.title, task.description);

    // Update task with result
    await db
      .update(tasks)
      .set({
        brainstormResult: JSON.stringify(result, null, 2),
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    const updatedTask = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    });

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error("Brainstorm error:", {
      taskId,
      provider: config.provider,
      model: config.model,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    // Revert status on error
    await db
      .update(tasks)
      .set({ status: "todo", updatedAt: new Date() })
      .where(eq(tasks.id, taskId));

    return handleError(error);
  }
});
