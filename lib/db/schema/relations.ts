import { relations } from "drizzle-orm";
import {
  users,
  repos,
  tasks,
  executions,
  executionEvents,
  workerJobs,
  workerEvents,
  repoIndex,
  subscriptionPlans,
  userSubscriptions,
  usageRecords,
  pendingChanges,
  testRuns,
  executionCommits,
  activityEvents,
  activitySummaries,
  taskDependencies,
} from "./tables";

// =============================================================================
// Relations
// =============================================================================

export const usersRelations = relations(users, ({ one, many }) => ({
  repos: many(repos),
  subscription: one(userSubscriptions, {
    fields: [users.id],
    references: [userSubscriptions.userId],
  }),
  usageRecords: many(usageRecords),
}));

export const reposRelations = relations(repos, ({ one, many }) => ({
  user: one(users, {
    fields: [repos.userId],
    references: [users.id],
  }),
  tasks: many(tasks),
  index: one(repoIndex, {
    fields: [repos.id],
    references: [repoIndex.repoId],
  }),
}));

export const repoIndexRelations = relations(repoIndex, ({ one }) => ({
  repo: one(repos, {
    fields: [repoIndex.repoId],
    references: [repos.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  repo: one(repos, {
    fields: [tasks.repoId],
    references: [repos.id],
  }),
  executions: many(executions),
  workerJobs: many(workerJobs),
  // Task dependencies - tasks this task is blocked by
  dependencies: many(taskDependencies, { relationName: "taskDependencies" }),
  // Tasks that are blocked by this task
  dependents: many(taskDependencies, { relationName: "blockedByDependencies" }),
}));

export const executionsRelations = relations(executions, ({ one, many }) => ({
  task: one(tasks, {
    fields: [executions.taskId],
    references: [tasks.id],
  }),
  events: many(executionEvents),
  pendingChanges: many(pendingChanges),
  testRuns: many(testRuns),
  commits: many(executionCommits),
}));

export const executionEventsRelations = relations(
  executionEvents,
  ({ one }) => ({
    execution: one(executions, {
      fields: [executionEvents.executionId],
      references: [executions.id],
    }),
  }),
);

export const workerJobsRelations = relations(workerJobs, ({ one, many }) => ({
  task: one(tasks, {
    fields: [workerJobs.taskId],
    references: [tasks.id],
  }),
  events: many(workerEvents),
}));

export const workerEventsRelations = relations(workerEvents, ({ one }) => ({
  workerJob: one(workerJobs, {
    fields: [workerEvents.workerJobId],
    references: [workerJobs.id],
  }),
}));

export const subscriptionPlansRelations = relations(
  subscriptionPlans,
  ({ many }) => ({
    subscriptions: many(userSubscriptions),
  }),
);

export const userSubscriptionsRelations = relations(
  userSubscriptions,
  ({ one }) => ({
    user: one(users, {
      fields: [userSubscriptions.userId],
      references: [users.id],
    }),
    plan: one(subscriptionPlans, {
      fields: [userSubscriptions.planId],
      references: [subscriptionPlans.id],
    }),
  }),
);

export const usageRecordsRelations = relations(usageRecords, ({ one }) => ({
  user: one(users, {
    fields: [usageRecords.userId],
    references: [users.id],
  }),
  task: one(tasks, {
    fields: [usageRecords.taskId],
    references: [tasks.id],
  }),
  execution: one(executions, {
    fields: [usageRecords.executionId],
    references: [executions.id],
  }),
}));

// P0 Relations
export const pendingChangesRelations = relations(pendingChanges, ({ one }) => ({
  execution: one(executions, {
    fields: [pendingChanges.executionId],
    references: [executions.id],
  }),
  task: one(tasks, {
    fields: [pendingChanges.taskId],
    references: [tasks.id],
  }),
}));

export const testRunsRelations = relations(testRuns, ({ one }) => ({
  execution: one(executions, {
    fields: [testRuns.executionId],
    references: [executions.id],
  }),
  task: one(tasks, {
    fields: [testRuns.taskId],
    references: [tasks.id],
  }),
}));

export const executionCommitsRelations = relations(
  executionCommits,
  ({ one }) => ({
    execution: one(executions, {
      fields: [executionCommits.executionId],
      references: [executions.id],
    }),
  }),
);

// Kanban Enhancement Relations
export const activityEventsRelations = relations(activityEvents, ({ one }) => ({
  task: one(tasks, {
    fields: [activityEvents.taskId],
    references: [tasks.id],
  }),
  repo: one(repos, {
    fields: [activityEvents.repoId],
    references: [repos.id],
  }),
  user: one(users, {
    fields: [activityEvents.userId],
    references: [users.id],
  }),
  execution: one(executions, {
    fields: [activityEvents.executionId],
    references: [executions.id],
  }),
}));

export const activitySummariesRelations = relations(
  activitySummaries,
  ({ one }) => ({
    user: one(users, {
      fields: [activitySummaries.userId],
      references: [users.id],
    }),
    repo: one(repos, {
      fields: [activitySummaries.repoId],
      references: [repos.id],
    }),
  }),
);

export const taskDependenciesRelations = relations(
  taskDependencies,
  ({ one }) => ({
    task: one(tasks, {
      fields: [taskDependencies.taskId],
      references: [tasks.id],
      relationName: "taskDependencies",
    }),
    blockedBy: one(tasks, {
      fields: [taskDependencies.blockedById],
      references: [tasks.id],
      relationName: "blockedByDependencies",
    }),
  }),
);
