import { db, repos } from "@/lib/db";
import { eq } from "drizzle-orm";
import type { Repo } from "@/lib/db/schema";
import { RepoAggregate } from "../aggregates/repo";

export class RepoRepository {
  async findById(repoId: string): Promise<RepoAggregate | null> {
    const repo = await db.query.repos.findFirst({
      where: eq(repos.id, repoId),
    });

    if (!repo) {
      return null;
    }

    return RepoAggregate.fromPersistence(repo as Repo);
  }
}
