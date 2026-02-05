import type { Task } from "../../entities/Task";
import type { Result } from "@/lib/shared/Result";
import type { RepositoryError } from "@/lib/shared/errors";

/**
 * Task repository port interface
 *
 * Defines persistence operations for Task aggregates.
 * Implementations must handle domain ↔ database mapping.
 */
export interface ITaskRepository {
  save(task: Task): Promise<Result<void, RepositoryError>>;
  findById(id: string): Promise<Result<Task | null, RepositoryError>>;
  findByRepo(repoId: string): Promise<Result<Task[], RepositoryError>>;
  findByUser(userId: string): Promise<Result<Task[], RepositoryError>>;
  delete(id: string): Promise<Result<void, RepositoryError>>;
  deleteByRepoIds(repoIds: string[]): Promise<Result<void, RepositoryError>>;
  getIdsByRepoIds(
    repoIds: string[],
  ): Promise<Result<string[], RepositoryError>>;
  existsById(id: string): Promise<Result<boolean, RepositoryError>>;
}
