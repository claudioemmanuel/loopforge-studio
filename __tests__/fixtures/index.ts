/**
 * Shared test data factories for consistent test setup
 */

import type { User, Repo, Task } from "@/lib/db/schema";

export const fixtures = {
  /**
   * Create a test user
   */
  user: (overrides?: Partial<User>): Omit<User, "id" | "createdAt"> => ({
    name: "Test User",
    email: "test@example.com",
    image: null,
    githubId: "123456",
    githubUsername: "testuser",
    githubAccessToken: null,
    subscriptionTier: "free",
    anthropicApiKey: null,
    openaiApiKey: null,
    geminiApiKey: null,
    preferredAiProvider: "anthropic",
    preferredAnthropicModel: "claude-sonnet-4-20250514",
    preferredOpenaiModel: null,
    preferredGeminiModel: null,
    ...overrides,
  }),

  /**
   * Create a test repository
   */
  repo: (overrides?: Partial<Repo>): Omit<Repo, "id" | "createdAt"> => ({
    userId: "user-id",
    githubId: 123456,
    name: "test-repo",
    fullName: "testuser/test-repo",
    private: false,
    cloneUrl: "https://github.com/testuser/test-repo.git",
    defaultBranch: "main",
    cloneDirectory: "/tmp/test-repos",
    cloneStatus: "idle",
    cloneProgress: 0,
    cloneError: null,
    clonedAt: null,
    testGatePolicy: "warn",
    criticalTestPatterns: [],
    ...overrides,
  }),

  /**
   * Create a test task
   */
  task: (overrides?: Partial<Task>): Omit<Task, "id" | "createdAt"> => ({
    userId: "user-id",
    repoId: "repo-id",
    title: "Test task",
    description: "Test task description",
    status: "todo",
    processingPhase: null,
    processingStatusText: null,
    branchName: null,
    autonomousMode: false,
    brainstormConversation: null,
    plan: null,
    updatedAt: new Date(),
    ...overrides,
  }),
};

/**
 * Usage in tests:
 *
 * import { fixtures } from "@/__tests__/fixtures";
 *
 * const user = await db.insert(users).values(fixtures.user()).returning();
 * const repo = await db.insert(repos).values(fixtures.repo({ userId: user.id })).returning();
 */
