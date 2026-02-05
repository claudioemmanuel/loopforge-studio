/**
 * Repo Index Repository (Infrastructure Layer)
 *
 * Persists repository indexing results.
 */

import { db } from "@/lib/db";
import { repoIndex } from "@/lib/db/schema/tables";
import { eq } from "drizzle-orm";
import type { IndexingResult } from "../domain/types";

export class RepoIndexRepository {
  async upsertIndex(params: { repositoryId: string; result: IndexingResult }) {
    const existing = await db
      .select({ id: repoIndex.id })
      .from(repoIndex)
      .where(eq(repoIndex.repoId, params.repositoryId));

    const now = new Date();
    const values = {
      repoId: params.repositoryId,
      fileCount: params.result.fileCount,
      symbolCount: params.result.symbolCount,
      techStack: params.result.techStack,
      entryPoints: params.result.entryPoints,
      dependencies: params.result.dependencies,
      fileIndex: params.result.fileIndex,
      updatedAt: now,
    };

    if (existing.length === 0) {
      await db.insert(repoIndex).values({
        ...values,
        createdAt: now,
      });
      return;
    }

    await db
      .update(repoIndex)
      .set(values)
      .where(eq(repoIndex.repoId, params.repositoryId));
  }
}
