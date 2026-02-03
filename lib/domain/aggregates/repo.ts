import type { Repo } from "@/lib/db/schema";
import { RepoId } from "../value-objects/identifiers";

export type RepoAggregateSnapshot = Repo;

export class RepoAggregate {
  private constructor(private state: RepoAggregateSnapshot) {}

  static fromPersistence(record: RepoAggregateSnapshot): RepoAggregate {
    return new RepoAggregate({ ...record });
  }

  get id(): RepoId {
    return new RepoId(this.state.id);
  }

  get snapshot(): RepoAggregateSnapshot {
    return { ...this.state };
  }

  ensureDefaultBranch() {
    if (!this.state.defaultBranch) {
      this.state.defaultBranch = "main";
    }
  }
}
