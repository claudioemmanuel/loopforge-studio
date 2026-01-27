import { db } from "@/lib/db";
import {
  users,
  repos,
  tasks,
  usageRecords,
  type BillingMode,
  type PlanLimits,
} from "@/lib/db/schema";
import { eq, and, gte, lte, count, sum } from "drizzle-orm";

// =============================================================================
// Token Pricing (per 1M tokens, in cents)
// =============================================================================

interface ModelPricing {
  inputPer1M: number; // cents per 1M input tokens
  outputPer1M: number; // cents per 1M output tokens
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  // Anthropic models
  "claude-sonnet-4-20250514": { inputPer1M: 300, outputPer1M: 1500 },
  "claude-opus-4-20250514": { inputPer1M: 1500, outputPer1M: 7500 },
  "claude-3-5-sonnet-20241022": { inputPer1M: 300, outputPer1M: 1500 },
  "claude-3-5-haiku-20241022": { inputPer1M: 80, outputPer1M: 400 },
  // OpenAI models
  "gpt-4o": { inputPer1M: 250, outputPer1M: 1000 },
  "gpt-4o-mini": { inputPer1M: 15, outputPer1M: 60 },
  "gpt-4-turbo": { inputPer1M: 1000, outputPer1M: 3000 },
  // Google models
  "gemini-2.5-pro": { inputPer1M: 125, outputPer1M: 500 },
  "gemini-2.0-flash": { inputPer1M: 10, outputPer1M: 40 },
  "gemini-1.5-pro": { inputPer1M: 125, outputPer1M: 500 },
};

// Default pricing for unknown models
const DEFAULT_PRICING: ModelPricing = { inputPer1M: 300, outputPer1M: 1500 };

/**
 * Calculate the cost of tokens for a given model
 * @returns cost in cents
 */
export function calculateTokenCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = MODEL_PRICING[model] || DEFAULT_PRICING;
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;
  return Math.ceil(inputCost + outputCost);
}

// =============================================================================
// Usage Tracking
// =============================================================================

interface RecordUsageParams {
  userId: string;
  taskId?: string;
  executionId?: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Record token usage for a user
 */
export async function recordUsage(params: RecordUsageParams): Promise<void> {
  const { userId, taskId, executionId, model, inputTokens, outputTokens } =
    params;

  // Get current billing period
  const { periodStart, periodEnd } = getCurrentBillingPeriod();

  const totalTokens = inputTokens + outputTokens;
  const estimatedCost = calculateTokenCost(model, inputTokens, outputTokens);

  await db.insert(usageRecords).values({
    userId,
    taskId: taskId || null,
    executionId: executionId || null,
    periodStart,
    periodEnd,
    model,
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCost,
  });
}

/**
 * Get the current billing period (monthly, aligned to subscription start)
 */
function getCurrentBillingPeriod(): { periodStart: Date; periodEnd: Date } {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
  return { periodStart, periodEnd };
}

// =============================================================================
// Usage Summary
// =============================================================================

export interface UsageSummary {
  currentPeriod: {
    start: Date;
    end: Date;
  };
  tokens: {
    used: number;
    limit: number;
    percentUsed: number;
  };
  tasks: {
    created: number;
    limit: number;
    percentUsed: number;
  };
  repos: {
    count: number;
    limit: number;
    percentUsed: number;
  };
  estimatedCost: number; // cents
  billingMode: BillingMode;
  plan: {
    name: string;
    tier: string;
  } | null;
}

/**
 * Get usage summary for a user
 */
export async function getUsageSummary(userId: string): Promise<UsageSummary> {
  const { periodStart, periodEnd } = getCurrentBillingPeriod();

  // Get user's subscription and plan
  const userWithSubscription = await db.query.users.findFirst({
    where: eq(users.id, userId),
    with: {
      subscription: {
        with: {
          plan: true,
        },
      },
    },
  });

  const billingMode = userWithSubscription?.billingMode || "byok";
  const subscription = userWithSubscription?.subscription;
  const plan = subscription?.plan;

  // Get plan limits (defaults for free tier)
  const limits: PlanLimits = plan?.limits || {
    maxRepos: 1,
    maxTasksPerMonth: 5,
    maxTokensPerMonth: 50_000,
  };

  // Get token usage for current period
  const tokenUsage = await db
    .select({
      totalTokens: sum(usageRecords.totalTokens),
      estimatedCost: sum(usageRecords.estimatedCost),
    })
    .from(usageRecords)
    .where(
      and(
        eq(usageRecords.userId, userId),
        gte(usageRecords.periodStart, periodStart),
        lte(usageRecords.periodEnd, periodEnd),
      ),
    );

  // Get task count for current period
  const taskCount = await db
    .select({ count: count() })
    .from(tasks)
    .innerJoin(repos, eq(tasks.repoId, repos.id))
    .where(
      and(
        eq(repos.userId, userId),
        gte(tasks.createdAt, periodStart),
        lte(tasks.createdAt, periodEnd),
      ),
    );

  // Get repo count
  const repoCount = await db
    .select({ count: count() })
    .from(repos)
    .where(eq(repos.userId, userId));

  const tokensUsed = Number(tokenUsage[0]?.totalTokens) || 0;
  const tasksCreated = taskCount[0]?.count || 0;
  const reposCount = repoCount[0]?.count || 0;

  return {
    currentPeriod: {
      start: periodStart,
      end: periodEnd,
    },
    tokens: {
      used: tokensUsed,
      limit: limits.maxTokensPerMonth,
      percentUsed: Math.min((tokensUsed / limits.maxTokensPerMonth) * 100, 100),
    },
    tasks: {
      created: tasksCreated,
      limit: limits.maxTasksPerMonth,
      percentUsed: Math.min(
        (tasksCreated / limits.maxTasksPerMonth) * 100,
        100,
      ),
    },
    repos: {
      count: reposCount,
      limit: limits.maxRepos,
      percentUsed: Math.min((reposCount / limits.maxRepos) * 100, 100),
    },
    estimatedCost: Number(tokenUsage[0]?.estimatedCost) || 0,
    billingMode,
    plan: plan
      ? {
          name: plan.name,
          tier: plan.tier,
        }
      : null,
  };
}

// =============================================================================
// Limit Checks
// =============================================================================

interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
  currentUsage?: number;
  limit?: number;
}

/**
 * Check if user can create a new task
 */
export async function canCreateTask(userId: string): Promise<LimitCheckResult> {
  const summary = await getUsageSummary(userId);

  // BYOK users with their own keys have no task limits
  if (summary.billingMode === "byok") {
    // Check if user has API keys configured
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    const hasApiKey = !!(
      user?.encryptedApiKey ||
      user?.openaiEncryptedApiKey ||
      user?.geminiEncryptedApiKey
    );

    if (hasApiKey) {
      return { allowed: true };
    }
  }

  if (summary.tasks.created >= summary.tasks.limit) {
    return {
      allowed: false,
      reason: `Task limit reached (${summary.tasks.limit} tasks per month)`,
      currentUsage: summary.tasks.created,
      limit: summary.tasks.limit,
    };
  }

  return { allowed: true };
}

/**
 * Check if user can execute a task (token limit check for managed mode)
 */
export async function canExecuteTask(
  userId: string,
): Promise<LimitCheckResult> {
  const summary = await getUsageSummary(userId);

  // BYOK users with their own keys have no token limits
  if (summary.billingMode === "byok") {
    return { allowed: true };
  }

  // For managed mode, check token limits
  if (summary.tokens.used >= summary.tokens.limit) {
    return {
      allowed: false,
      reason: `Token limit reached (${formatTokens(summary.tokens.limit)} per month)`,
      currentUsage: summary.tokens.used,
      limit: summary.tokens.limit,
    };
  }

  return { allowed: true };
}

/**
 * Check if user can add a new repository
 */
export async function canAddRepo(userId: string): Promise<LimitCheckResult> {
  const summary = await getUsageSummary(userId);

  if (summary.repos.count >= summary.repos.limit) {
    return {
      allowed: false,
      reason: `Repository limit reached (${summary.repos.limit} repos)`,
      currentUsage: summary.repos.count,
      limit: summary.repos.limit,
    };
  }

  return { allowed: true };
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Format token count for display
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toString();
}

/**
 * Format cost for display
 */
export function formatCost(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
