import { cache } from "react";
import { db, users, repos, tasks } from "@/lib/db";
import { eq, and } from "drizzle-orm";

/**
 * React cache() wrappers for request deduplication.
 * These deduplicate identical queries within a single request lifecycle,
 * so multiple components/routes calling the same query only hit the DB once.
 */

export const getUser = cache(async (userId: string) => {
  return db.query.users.findFirst({
    where: eq(users.id, userId),
  });
});

export const getUserWithSubscription = cache(async (userId: string) => {
  return db.query.users.findFirst({
    where: eq(users.id, userId),
    with: {
      subscription: {
        with: {
          plan: true,
        },
      },
    },
  });
});

export const getRepos = cache(async (userId: string) => {
  return db.query.repos.findMany({
    where: eq(repos.userId, userId),
  });
});

export const getRepo = cache(async (repoId: string, userId: string) => {
  return db.query.repos.findFirst({
    where: and(eq(repos.id, repoId), eq(repos.userId, userId)),
  });
});

export const getTask = cache(async (taskId: string) => {
  return db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: { repo: true },
  });
});

export const getTasksByRepo = cache(async (repoId: string) => {
  return db.query.tasks.findMany({
    where: eq(tasks.repoId, repoId),
  });
});
