import { and, eq, ne } from "drizzle-orm";
import { db, tasks } from "@/lib/db";
import type { Task } from "@/lib/db/schema";
import type { TaskAggregate } from "../aggregates/task";

export class TaskRepository {
  async create(aggregate: TaskAggregate): Promise<Task> {
    const snapshot = aggregate.snapshot;
    await db.insert(tasks).values(snapshot);
    aggregate.clearChanges();
    return snapshot;
  }

  async save(aggregate: TaskAggregate): Promise<Task> {
    const changes = aggregate.getChanges();
    if (Object.keys(changes).length === 0) {
      return aggregate.snapshot;
    }

    const updatedAt = new Date();
    await db
      .update(tasks)
      .set({ ...changes, updatedAt })
      .where(eq(tasks.id, aggregate.id.value));
    aggregate.clearChanges();

    const updatedTask = await db.query.tasks.findFirst({
      where: eq(tasks.id, aggregate.id.value),
    });

    if (!updatedTask) {
      throw new Error("Task not found after update");
    }

    return updatedTask;
  }

  async saveWithStatusGuard(
    aggregate: TaskAggregate,
    guard: { eq?: Task["status"]; ne?: Task["status"] },
  ): Promise<Task | null> {
    const changes = aggregate.getChanges();
    if (Object.keys(changes).length === 0) {
      return aggregate.snapshot;
    }

    let condition = eq(tasks.id, aggregate.id.value);
    if (guard.eq) {
      condition = and(condition, eq(tasks.status, guard.eq));
    }
    if (guard.ne) {
      condition = and(condition, ne(tasks.status, guard.ne));
    }

    const updatedAt = new Date();
    const claim = await db
      .update(tasks)
      .set({ ...changes, updatedAt })
      .where(condition)
      .returning({ id: tasks.id });

    if (claim.length === 0) {
      return null;
    }

    aggregate.clearChanges();
    const updatedTask = await db.query.tasks.findFirst({
      where: eq(tasks.id, aggregate.id.value),
    });

    if (!updatedTask) {
      throw new Error("Task not found after guarded update");
    }

    return updatedTask;
  }
}
