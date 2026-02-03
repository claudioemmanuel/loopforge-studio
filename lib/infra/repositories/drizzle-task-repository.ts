import { and, eq, or } from "drizzle-orm";
import { db, tasks } from "@/lib/db";
import type { TaskRepository } from "@/lib/application/ports/repositories";
import type { TaskSummary } from "@/lib/application/ports/domain";

export class DrizzleTaskRepository implements TaskRepository {
  async getTaskWithRepo(taskId: string): Promise<TaskSummary | null> {
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
      with: { repo: true },
    });

    if (!task) return null;

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      branch: task.branch,
      repo: {
        id: task.repo.id,
        name: task.repo.name,
        fullName: task.repo.fullName,
        defaultBranch: task.repo.defaultBranch,
        cloneUrl: task.repo.cloneUrl,
        prDraftDefault: task.repo.prDraftDefault,
        prLabels: task.repo.prLabels,
        prReviewers: task.repo.prReviewers,
      },
    };
  }

  async setBrainstormResult(taskId: string, result: string): Promise<boolean> {
    const update = await db
      .update(tasks)
      .set({
        brainstormResult: result,
        status: "brainstorming",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tasks.id, taskId),
          or(eq(tasks.status, "todo"), eq(tasks.status, "brainstorming")),
        ),
      )
      .returning({ id: tasks.id });

    return update.length > 0;
  }

  async setPlanResult(
    taskId: string,
    plan: string,
    branch: string,
  ): Promise<boolean> {
    const update = await db
      .update(tasks)
      .set({
        planContent: plan,
        status: "planning",
        branch,
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.id, taskId), eq(tasks.status, "brainstorming")))
      .returning({ id: tasks.id });

    return update.length > 0;
  }

  async updateStatusIf(
    taskId: string,
    fromStatus: TaskSummary["status"],
    toStatus: TaskSummary["status"],
  ): Promise<boolean> {
    const update = await db
      .update(tasks)
      .set({
        status: toStatus,
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.id, taskId), eq(tasks.status, fromStatus)))
      .returning({ id: tasks.id });

    return update.length > 0;
  }

  async updateStatus(taskId: string, status: TaskSummary["status"]): Promise<void> {
    await db
      .update(tasks)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));
  }
}
