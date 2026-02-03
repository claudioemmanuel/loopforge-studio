import type { TaskStatus } from "@/lib/db/schema";

export class TaskStatusTransition {
  constructor(
    public readonly from: TaskStatus,
    public readonly to: TaskStatus,
  ) {}

  isNoop(): boolean {
    return this.from === this.to;
  }
}
