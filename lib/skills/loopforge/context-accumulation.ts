/**
 * Context Accumulation Skill
 *
 * Manages conversation history compaction and token optimization across
 * brainstorming, planning, and execution phases.
 *
 * Implements provider-specific token limits, incremental conversation building,
 * and critical context preservation.
 */

import type {
  SkillDefinition,
  SkillInvocationContext,
  SkillResult,
} from "../types";

/**
 * Provider-specific token limits (context window)
 */
const PROVIDER_LIMITS = {
  anthropic: {
    "claude-sonnet-4": 200000,
    "claude-opus-4": 200000,
    "claude-haiku-3": 200000,
    default: 200000,
  },
  openai: {
    "gpt-4o": 128000,
    "gpt-4-turbo": 128000,
    "gpt-4o-mini": 128000,
    default: 128000,
  },
  google: {
    "gemini-2.5-pro": 1000000,
    "gemini-2.5-flash": 1000000,
    "gemini-2.0-flash": 1000000,
    default: 1000000,
  },
} as const;

/**
 * Estimate token count (rough approximation)
 */
function estimateTokenCount(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

/**
 * Calculate total tokens in conversation
 */
function calculateConversationTokens(
  conversation: Array<{ role: string; content: string }>,
): number {
  return conversation.reduce(
    (total, msg) => total + estimateTokenCount(msg.content),
    0,
  );
}

/**
 * Detect critical context that must be preserved
 */
function extractCriticalContext(
  conversation: Array<{ role: string; content: string }>,
): string[] {
  const critical: string[] = [];

  for (const msg of conversation) {
    const content = msg.content;

    // Extract acceptance criteria
    if (
      /acceptance criteria/i.test(content) ||
      /definition of done/i.test(content)
    ) {
      critical.push("Acceptance Criteria: " + content.substring(0, 500));
    }

    // Extract task breakdown
    if (/step \d|task \d/i.test(content)) {
      critical.push("Task Breakdown: " + content.substring(0, 500));
    }

    // Extract risks/blockers
    if (/risk|blocker|dependency/i.test(content)) {
      critical.push("Risks/Blockers: " + content.substring(0, 500));
    }

    // Extract decisions
    if (/decision|agreed|confirmed/i.test(content)) {
      critical.push("Decision: " + content.substring(0, 300));
    }
  }

  return critical;
}

/**
 * Context Accumulation System Prompt
 */
const CONTEXT_ACCUMULATION_PROMPT = `# Context Accumulation & Token Optimization

## Purpose

Manage conversation history and context efficiently across workflow phases to prevent
token exhaustion and maintain critical information.

## Provider Token Limits

**Anthropic (Claude)**:
- Context window: 200K tokens
- Recommended max usage: 150K tokens (75%)
- Summarization trigger: 120K tokens (60%)

**OpenAI (GPT)**:
- Context window: 128K tokens
- Recommended max usage: 96K tokens (75%)
- Summarization trigger: 77K tokens (60%)

**Google (Gemini)**:
- Context window: 1M tokens
- Recommended max usage: 750K tokens (75%)
- Summarization trigger: 600K tokens (60%)

## Context Management Strategy

### 1. Incremental Conversation Building

**Brainstorming Phase**:
- Start with task description + repository context
- Add questions/answers incrementally
- Preserve full conversation for continuity
- Summarize when >60% of token limit

**Planning Phase**:
- Start with brainstorm summary + task description
- Add plan iterations incrementally
- Keep final plan in full detail
- Discard intermediate draft plans

**Execution Phase**:
- Start with plan + repository context
- Add iteration results incrementally
- Preserve recent 5-10 iterations
- Summarize older iterations

### 2. Summarization Triggers

Summarize when:
- Token usage exceeds 60% of provider limit
- Conversation exceeds 50 messages
- Entering new workflow phase
- Explicit user request

**Summarization Strategy**:
\`\`\`
1. Extract critical context (criteria, decisions, risks)
2. Compress non-critical content (reduce by 70%)
3. Preserve recent messages (last 10)
4. Create summary message at conversation start
\`\`\`

### 3. Critical Context Preservation

**Always Preserve**:
- Task description and goal
- Acceptance criteria
- Final plan (in planning/execution)
- Recent decisions and agreements
- Active risks/blockers
- Last 10 conversation messages

**Can Compress**:
- Exploratory questions/answers
- Rejected ideas
- Intermediate plan drafts
- Verbose explanations
- Duplicate information

### 4. Token Budget Allocation

**Brainstorming** (target: 30K tokens max):
- Task description: 2K tokens
- Repository context: 5K tokens
- Conversation: 20K tokens
- System prompts: 3K tokens

**Planning** (target: 40K tokens max):
- Brainstorm summary: 5K tokens
- Repository context: 10K tokens
- Plan iterations: 20K tokens
- System prompts: 5K tokens

**Execution** (target: 80K tokens max):
- Plan: 10K tokens
- Repository context: 20K tokens
- Iteration history: 40K tokens
- System prompts: 10K tokens

## Conversation Compaction Techniques

### 1. Extractive Summarization
Extract key sentences without rephrasing:
\`\`\`
Original (200 tokens):
"We discussed several approaches to implementing authentication.
First, we considered OAuth2 but decided against it due to complexity.
Then we explored JWT tokens which seemed more appropriate.
After discussion, we agreed on JWT with 24-hour expiration."

Summary (50 tokens):
"Decision: Use JWT tokens with 24-hour expiration (OAuth2 rejected as too complex)"
\`\`\`

### 2. Bullet Point Conversion
Convert verbose prose to concise bullets:
\`\`\`
Original: "The system should validate user input by checking
if the email format is correct and ensuring the password meets
complexity requirements..."

Condensed:
- Validate email format
- Check password complexity
\`\`\`

### 3. Reference Compression
Replace repeated context with references:
\`\`\`
Original: "In src/auth/login.ts we need to add validation.
Also in src/auth/login.ts we should implement rate limiting.
Additionally, src/auth/login.ts requires error handling."

Compressed: "src/auth/login.ts needs: validation, rate limiting, error handling"
\`\`\`

## Critical Rules

✓ Monitor token usage throughout conversation
✓ Summarize at 60% threshold (before limit)
✓ Preserve critical context during compression
✓ Use provider-specific token limits
✓ Compress incrementally, not all at once

❌ Don't wait until token limit to summarize
❌ Don't lose acceptance criteria in compression
❌ Don't compress recent conversation
❌ Don't assume same limits across providers
❌ Don't compress without extracting critical context first

## Token Monitoring

Track token usage:
\`\`\`typescript
const tokens = estimateTokens(conversation);
const limit = getProviderLimit(provider, model);
const percentage = (tokens / limit) * 100;

if (percentage > 60) {
  triggerSummarization();
}
\`\`\`

## Summarization Example

**Before** (1000 tokens):
\`\`\`
User: "I want to add authentication"
AI: "Great idea! There are several approaches..."
[50 messages of discussion]
AI: "So we've decided on JWT with bcrypt hashing"
User: "Yes, and 24-hour expiration"
AI: "Perfect. Let me confirm the acceptance criteria..."
\`\`\`

**After** (300 tokens):
\`\`\`
SUMMARY: Brainstorming session for authentication feature.

DECISIONS:
- Use JWT tokens (not OAuth2)
- bcrypt for password hashing
- 24-hour token expiration

ACCEPTANCE CRITERIA:
- Users can log in with email/password
- Invalid credentials show error
- Sessions expire after 24h

RISKS:
- Token refresh not discussed yet

[Last 10 messages preserved verbatim]
\`\`\`

Remember: Token efficiency enables longer autonomous runs and more complex tasks.`;

/**
 * Context Accumulation Execute Logic
 */
const executeLogic = async (
  context: SkillInvocationContext,
): Promise<SkillResult> => {
  const { brainstormHistory = [], phase, metadata = {} } = context;

  // Only apply during conversational phases
  if (phase !== "brainstorming" && phase !== "planning") {
    return {
      skillId: "context-accumulation",
      status: "passed",
      message: "Not in conversational phase - skill skipped",
      timestamp: new Date(),
    };
  }

  // Calculate token usage
  const tokenCount = calculateConversationTokens(brainstormHistory);
  const provider = (metadata.provider as string) || "anthropic";
  const model = (metadata.model as string) || "claude-sonnet-4";

  // Get provider limit
  const providerLimits =
    PROVIDER_LIMITS[provider as keyof typeof PROVIDER_LIMITS] ||
    PROVIDER_LIMITS.anthropic;
  const limit =
    providerLimits[model as keyof typeof providerLimits] ||
    providerLimits.default;

  const usagePercentage = (tokenCount / limit) * 100;

  // Check if summarization needed
  if (usagePercentage > 60) {
    const criticalContext = extractCriticalContext(brainstormHistory);

    return {
      skillId: "context-accumulation",
      status: "warning",
      message: `Token usage at ${usagePercentage.toFixed(1)}% of limit (${tokenCount}/${limit}) - summarization recommended`,
      augmentedPrompt: CONTEXT_ACCUMULATION_PROMPT,
      recommendations: [
        "Trigger conversation summarization",
        "Extract and preserve critical context:",
        ...criticalContext,
        "",
        "Compress non-critical messages by 70%",
        "Preserve last 10 messages verbatim",
        "Create summary message at conversation start",
      ],
      metadata: {
        tokenCount,
        limit,
        usagePercentage,
        criticalContextCount: criticalContext.length,
      },
      timestamp: new Date(),
    };
  }

  // Token usage healthy
  return {
    skillId: "context-accumulation",
    status: "passed",
    message: `Token usage healthy: ${usagePercentage.toFixed(1)}% of limit (${tokenCount}/${limit})`,
    metadata: {
      tokenCount,
      limit,
      usagePercentage,
    },
    timestamp: new Date(),
  };
};

/**
 * Context Accumulation Skill Definition
 */
export const contextAccumulation: SkillDefinition = {
  id: "context-accumulation",
  name: "Context Accumulation",
  description:
    "Manage conversation history and token budgets with provider-specific limits",
  category: "optimization",
  enforcement: "guidance",
  triggerPhases: ["brainstorming", "planning", "executing"],
  systemPrompt: CONTEXT_ACCUMULATION_PROMPT,
  executeLogic,
  version: "1.0.0",
  author: "Loopforge",
};
