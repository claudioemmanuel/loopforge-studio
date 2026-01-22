import { pgTable, pgEnum, uuid, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { ExecutionEventMetadata } from "@/lib/ralph/types";

// =============================================================================
// Enums
// =============================================================================

export const taskStatusEnum = pgEnum("task_status", [
  "todo",
  "brainstorming",
  "planning",
  "ready",
  "executing",
  "done",
  "stuck",
]);

export const executionStatusEnum = pgEnum("execution_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const executionEventTypeEnum = pgEnum("execution_event_type", [
  "thinking",
  "file_read",
  "file_write",
  "command_run",
  "commit",
  "error",
  "complete",
  "stuck",
]);

export const billingCycleEnum = pgEnum("billing_cycle", ["monthly", "yearly"]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "canceled",
  "past_due",
  "trialing",
]);

export const billingModeEnum = pgEnum("billing_mode", ["byok", "managed"]);

export const aiProviderEnum = pgEnum("ai_provider", ["anthropic", "openai", "gemini"]);

// =============================================================================
// Core Tables
// =============================================================================

// Users table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  githubId: text("github_id").notNull().unique(),
  username: text("username").notNull(),
  email: text("email"),
  avatarUrl: text("avatar_url"),
  encryptedApiKey: text("encrypted_api_key"), // Anthropic API key (legacy column name)
  apiKeyIv: text("api_key_iv"), // Anthropic API key IV
  openaiEncryptedApiKey: text("openai_encrypted_api_key"),
  openaiApiKeyIv: text("openai_api_key_iv"),
  geminiEncryptedApiKey: text("gemini_encrypted_api_key"),
  geminiApiKeyIv: text("gemini_api_key_iv"),
  preferredAnthropicModel: text("preferred_anthropic_model").default("claude-sonnet-4-20250514"),
  preferredOpenaiModel: text("preferred_openai_model").default("gpt-4o"),
  preferredGeminiModel: text("preferred_gemini_model").default("gemini-2.5-pro"),
  preferredProvider: aiProviderEnum("preferred_provider").default("anthropic"),
  encryptedGithubToken: text("encrypted_github_token"),
  githubTokenIv: text("github_token_iv"),
  billingMode: billingModeEnum("billing_mode"), // null until onboarding chooses
  stripeCustomerId: text("stripe_customer_id"), // set when managed user creates Stripe customer
  onboardingCompleted: boolean("onboarding_completed").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Repositories table
export const repos = pgTable("repos", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  githubRepoId: text("github_repo_id").notNull(),
  name: text("name").notNull(),
  fullName: text("full_name").notNull(),
  defaultBranch: text("default_branch").notNull().default("main"),
  cloneUrl: text("clone_url").notNull(),
  isPrivate: boolean("is_private").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Tasks table
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  repoId: uuid("repo_id").notNull().references(() => repos.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: taskStatusEnum("status").notNull().default("todo"),
  priority: integer("priority").notNull().default(0),
  brainstormResult: text("brainstorm_result"),
  brainstormConversation: text("brainstorm_conversation"), // JSON array of chat messages
  planContent: text("plan_content"),
  branch: text("branch"),
  autonomousMode: boolean("autonomous_mode").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Executions table
export const executions = pgTable("executions", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  status: executionStatusEnum("status").notNull().default("queued"),
  iteration: integer("iteration").notNull().default(0),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
  logsPath: text("logs_path"),
  commits: jsonb("commits").$type<string[]>(), // Array of commit SHAs
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Execution events for live activity feed
export const executionEvents = pgTable("execution_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  executionId: uuid("execution_id").notNull().references(() => executions.id, { onDelete: "cascade" }),
  eventType: executionEventTypeEnum("event_type").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata").$type<ExecutionEventMetadata>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =============================================================================
// Subscription Tables
// =============================================================================

// Subscription plans table
export const subscriptionPlans = pgTable("subscription_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(), // e.g., "pro", "team"
  displayName: text("display_name").notNull(), // e.g., "Pro", "Team"
  priceMonthly: integer("price_monthly").notNull(), // in cents, e.g., 3900 = $39
  priceYearly: integer("price_yearly").notNull(), // in cents, e.g., 39000 = $390
  stripePriceMonthly: text("stripe_price_monthly"), // Stripe price ID for monthly billing
  stripePriceYearly: text("stripe_price_yearly"), // Stripe price ID for yearly billing
  taskLimit: integer("task_limit").notNull(), // e.g., 30, 100
  gracePercent: integer("grace_percent").notNull().default(10), // 10% overage allowed
  features: jsonb("features").$type<string[]>(), // Feature list for display
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// User subscriptions table
export const userSubscriptions = pgTable("user_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  planId: uuid("plan_id").notNull().references(() => subscriptionPlans.id),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeCustomerId: text("stripe_customer_id"),
  billingCycle: billingCycleEnum("billing_cycle").notNull().default("monthly"),
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  status: subscriptionStatusEnum("status").notNull().default("active"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Usage records table
export const usageRecords = pgTable("usage_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
  periodStart: timestamp("period_start").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  costCents: integer("cost_cents").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =============================================================================
// Relations
// =============================================================================

export const usersRelations = relations(users, ({ many, one }) => ({
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
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  repo: one(repos, {
    fields: [tasks.repoId],
    references: [repos.id],
  }),
  executions: many(executions),
  usageRecords: many(usageRecords),
}));

export const executionsRelations = relations(executions, ({ one, many }) => ({
  task: one(tasks, {
    fields: [executions.taskId],
    references: [tasks.id],
  }),
  events: many(executionEvents),
}));

export const executionEventsRelations = relations(executionEvents, ({ one }) => ({
  execution: one(executions, {
    fields: [executionEvents.executionId],
    references: [executions.id],
  }),
}));

export const subscriptionPlansRelations = relations(subscriptionPlans, ({ many }) => ({
  subscriptions: many(userSubscriptions),
}));

export const userSubscriptionsRelations = relations(userSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [userSubscriptions.userId],
    references: [users.id],
  }),
  plan: one(subscriptionPlans, {
    fields: [userSubscriptions.planId],
    references: [subscriptionPlans.id],
  }),
}));

export const usageRecordsRelations = relations(usageRecords, ({ one }) => ({
  user: one(users, {
    fields: [usageRecords.userId],
    references: [users.id],
  }),
  task: one(tasks, {
    fields: [usageRecords.taskId],
    references: [tasks.id],
  }),
}));

// =============================================================================
// Type Exports
// =============================================================================

// Task status values for compatibility
export const taskStatuses = [
  "todo",
  "brainstorming",
  "planning",
  "ready",
  "executing",
  "done",
  "stuck",
] as const;

export type TaskStatus = (typeof taskStatuses)[number];

// Billing mode values
export const billingModes = ["byok", "managed"] as const;
export type BillingMode = (typeof billingModes)[number];

// AI provider values
export const aiProviders = ["anthropic", "openai", "gemini"] as const;
export type AiProvider = (typeof aiProviders)[number];

// Core types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Repo = typeof repos.$inferSelect;
export type NewRepo = typeof repos.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type Execution = typeof executions.$inferSelect;
export type NewExecution = typeof executions.$inferInsert;
export type ExecutionEvent = typeof executionEvents.$inferSelect;
export type NewExecutionEvent = typeof executionEvents.$inferInsert;

// Subscription types
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type NewSubscriptionPlan = typeof subscriptionPlans.$inferInsert;
export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type NewUserSubscription = typeof userSubscriptions.$inferInsert;
export type UsageRecord = typeof usageRecords.$inferSelect;
export type NewUsageRecord = typeof usageRecords.$inferInsert;
