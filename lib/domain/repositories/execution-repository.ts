import { db, executions } from "@/lib/db";
import type { Execution } from "@/lib/db/schema";
import type { ExecutionAggregate } from "../aggregates/execution";

export class ExecutionRepository {
  async create(aggregate: ExecutionAggregate): Promise<Execution> {
    const snapshot = aggregate.snapshot;
    await db.insert(executions).values(snapshot);
    return snapshot;
  }
}
