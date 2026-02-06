/**
 * Shared test data factories for consistent test setup
 */

import type { User, Repo, Task } from "@/lib/db/schema";

export const fixtures = {
  /**
   * Create a test user
   */
  user: (overrides?: Partial<User>): Omit<User, "id" | "createdAt"> => ({
    githubId: "123456",
    username: "testuser",
    email: "test@example.com",
    avatarUrl: null,
    encryptedApiKey: null,
    apiKeyIv: null,
    openaiEncryptedApiKey: null,
    openaiApiKeyIv: null,
    geminiEncryptedApiKey: null,
    geminiApiKeyIv: null,
    preferredAnthropicModel: "claude-sonnet-4-20250514",
    preferredOpenaiModel: "gpt-4o",
    preferredGeminiModel: "gemini-2.5-pro",
    preferredProvider: "anthropic",
    encryptedGithubToken: null,
    githubTokenIv: null,
    onboardingCompleted: false,
    defaultCloneDirectory: null,
    defaultTestCommand: null,
    defaultTestTimeout: 300000,
    defaultTestGatePolicy: "warn",
    billingMode: "byok",
    stripeCustomerId: null,
    subscriptionTier: "free",
    subscriptionStatus: "active",
    subscriptionPeriodEnd: null,
    locale: "en",
    updatedAt: new Date(),
    ...overrides,
  }),

  /**
   * Create a test repository
   */
  repo: (overrides?: Partial<Repo>): Omit<Repo, "id" | "createdAt"> => ({
    userId: "user-id",
    githubRepoId: "123456",
    name: "test-repo",
    fullName: "testuser/test-repo",
    defaultBranch: "main",
    cloneUrl: "https://github.com/testuser/test-repo.git",
    isPrivate: false,
    localPath: null,
    isCloned: false,
    clonedAt: null,
    cloneStatus: "pending",
    clonePath: null,
    cloneStartedAt: null,
    cloneCompletedAt: null,
    indexingStatus: "pending",
    indexedAt: null,
    testCommand: null,
    testTimeout: 300000,
    testsEnabled: true,
    prTitleTemplate: "[LoopForge] {{title}}",
    prTargetBranch: null,
    prDraftDefault: false,
    prReviewers: [],
    prLabels: [],
    autoApprove: false,
    testGatePolicy: "warn",
    criticalTestPatterns: [],
    updatedAt: new Date(),
    ...overrides,
  }),

  /**
   * Create a test task
   */
  task: (overrides?: Partial<Task>): Omit<Task, "id" | "createdAt"> => ({
    repoId: "repo-id",
    title: "Test task",
    description: "Test task description",
    status: "todo",
    priority: 0,
    brainstormResult: null,
    brainstormConversation: null,
    brainstormSummary: null,
    brainstormMessageCount: 0,
    brainstormCompactedAt: null,
    planContent: null,
    branch: null,
    autonomousMode: false,
    autoApprove: false,
    processingPhase: null,
    processingJobId: null,
    processingStartedAt: null,
    processingStatusText: null,
    processingProgress: 0,
    statusHistory: [],
    prUrl: null,
    prNumber: null,
    prTargetBranch: null,
    prDraft: null,
    blockedByIds: [],
    autoExecuteWhenUnblocked: false,
    dependencyPriority: 0,
    executionGraph: null,
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
