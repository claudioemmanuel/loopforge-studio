import { eq } from "drizzle-orm";
import { db, repos } from "@/lib/db";
import type { RepoRepository } from "@/lib/application/ports/repositories";
import type { RepoSummary } from "@/lib/application/ports/domain";

export class DrizzleRepoRepository implements RepoRepository {
  async getRepoById(repoId: string): Promise<RepoSummary | null> {
    const repo = await db.query.repos.findFirst({
      where: eq(repos.id, repoId),
    });

    if (!repo) return null;

    return {
      id: repo.id,
      name: repo.name,
      fullName: repo.fullName,
      defaultBranch: repo.defaultBranch,
      cloneUrl: repo.cloneUrl,
      prDraftDefault: repo.prDraftDefault,
      prLabels: repo.prLabels,
      prReviewers: repo.prReviewers,
    };
  }
}
