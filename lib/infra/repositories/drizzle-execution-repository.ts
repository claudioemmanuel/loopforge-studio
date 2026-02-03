import { eq } from "drizzle-orm";
import { db, executions } from "@/lib/db";
import type { ExecutionRepository } from "@/lib/application/ports/repositories";
import type { ExecutionSummary } from "@/lib/application/ports/domain";

export class DrizzleExecutionRepository implements ExecutionRepository {
  async createExecution(taskId: string): Promise<ExecutionSummary> {
    const [execution] = await db
      .insert(executions)
      .values({
        taskId,
        status: "queued",
        iteration: 0,
      })
      .returning();

    return {
      id: execution.id,
      taskId: execution.taskId,
      status: execution.status,
      iteration: execution.iteration,
    };
  }

  async deleteExecution(executionId: string): Promise<void> {
    await db.delete(executions).where(eq(executions.id, executionId));
  }
}
