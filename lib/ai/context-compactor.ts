/**
 * Context Compaction for Brainstorming Conversations
 *
 * Implements hybrid sliding window + AI summarization strategy
 * aligned with PROMPT-ENGINEERING.md framework (lines 314-341, 477-511):
 * - Preserves system prompt, repo context, and last 10 messages
 * - Compresses earlier messages into structured summary
 * - Triggers after 20 messages OR 30K tokens
 * - Target: 3x+ compression ratio, 0% critical information loss
 */

import type { AIClient, ChatMessage } from "./client";
import type { AiProvider } from "@/lib/db/schema/types";
import { estimateMessagesTokenCount } from "./token-estimator";

/**
 * Options for compaction behavior
 * Aligned with PROMPT-ENGINEERING.md framework (lines 333, 483, 497)
 */
export interface CompactionOptions {
  /** Number of recent messages to preserve (default: 10) */
  recentMessageWindow?: number;
  /** Trigger after this many messages (default: 20) */
  messageThreshold?: number;
  /** Trigger when estimated tokens exceed this (default: 30000) */
  tokenThreshold?: number;
}

/**
 * Result of compaction operation
 */
export interface CompactionResult {
  /** Compacted messages array (system + summary + recent) */
  messages: ChatMessage[];
  /** Compressed summary of earlier messages */
  summary: string;
  /** Compression metrics */
  metrics: {
    originalMessageCount: number;
    compactedMessageCount: number;
    originalTokens: number;
    compactedTokens: number;
    compressionRatio: number;
  };
}

/**
 * Check if messages should be compacted
 */
export function shouldCompact(
  messages: ChatMessage[],
  provider: AiProvider,
  options: CompactionOptions = {},
): boolean {
  const messageThreshold = options.messageThreshold ?? 20;
  const tokenThreshold = options.tokenThreshold ?? 30000;

  // Check message count
  if (messages.length > messageThreshold) {
    return true;
  }

  // Check token count
  const estimatedTokens = estimateMessagesTokenCount(messages, provider);
  if (estimatedTokens > tokenThreshold) {
    return true;
  }

  return false;
}

/**
 * Compact messages using hybrid strategy
 *
 * @param client - AI client for generating summary
 * @param messages - Original messages array
 * @param currentSummary - Existing summary from previous compaction (optional)
 * @param options - Compaction options
 * @returns Compaction result with new messages and metrics
 */
export async function compactMessages(
  client: AIClient,
  messages: ChatMessage[],
  currentSummary: string | null = null,
  options: CompactionOptions = {},
): Promise<CompactionResult> {
  const recentWindow = options.recentMessageWindow ?? 10;
  const provider = client.getProvider();

  // Separate system messages, conversation messages
  const systemMessages = messages.filter((m) => m.role === "system");
  const conversationMessages = messages.filter((m) => m.role !== "system");

  // Calculate split point
  const totalConversation = conversationMessages.length;
  const splitIndex = Math.max(0, totalConversation - recentWindow);

  const messagesToCompress = conversationMessages.slice(0, splitIndex);
  const recentMessages = conversationMessages.slice(splitIndex);

  // If nothing to compress, return original messages
  if (messagesToCompress.length === 0) {
    return {
      messages,
      summary: currentSummary || "",
      metrics: {
        originalMessageCount: messages.length,
        compactedMessageCount: messages.length,
        originalTokens: estimateMessagesTokenCount(messages, provider),
        compactedTokens: estimateMessagesTokenCount(messages, provider),
        compressionRatio: 1.0,
      },
    };
  }

  // Generate summary using AI
  const summary = await generateSummary(
    client,
    messagesToCompress,
    currentSummary,
  );

  // Build compacted messages array
  const compactedMessages: ChatMessage[] = [
    ...systemMessages,
    {
      role: "user",
      content: `PREVIOUS CONVERSATION SUMMARY:\n${summary}\n\n[Continuing from recent messages below...]`,
    },
    ...recentMessages,
  ];

  // Calculate metrics
  const originalTokens = estimateMessagesTokenCount(messages, provider);
  const compactedTokens = estimateMessagesTokenCount(
    compactedMessages,
    provider,
  );
  const compressionRatio =
    compactedTokens > 0 ? originalTokens / compactedTokens : 1.0;

  return {
    messages: compactedMessages,
    summary,
    metrics: {
      originalMessageCount: messages.length,
      compactedMessageCount: compactedMessages.length,
      originalTokens,
      compactedTokens,
      compressionRatio,
    },
  };
}

/**
 * Generate structured summary of messages using AI
 */
async function generateSummary(
  client: AIClient,
  messages: ChatMessage[],
  existingSummary: string | null,
): Promise<string> {
  const conversationText = messages
    .map((m) => `[${m.role.toUpperCase()}]: ${m.content}`)
    .join("\n\n");

  const summaryPrompt = `You are compressing a brainstorming conversation to preserve critical information while reducing token usage.

${existingSummary ? `EXISTING SUMMARY FROM PREVIOUS COMPACTION:\n${existingSummary}\n\n` : ""}MESSAGES TO SUMMARIZE:
${conversationText}

INSTRUCTIONS:
1. Preserve ALL key decisions, requirements, and acceptance criteria
2. Keep technical details, constraints, and dependencies
3. Maintain chronological flow of discussion
4. Use structured format: Summary, Requirements, Decisions, Considerations
5. Be concise but comprehensive - do not lose critical information

Output a structured summary in the following format:

## Summary
[High-level overview of what was discussed]

## Key Requirements
- Requirement 1
- Requirement 2
...

## Decisions Made
- Decision 1
- Decision 2
...

## Technical Considerations
- Consideration 1
- Consideration 2
...

## Open Questions
- Question 1
- Question 2
...`;

  const summaryResponse = await client.chat(
    [{ role: "user", content: summaryPrompt }],
    { maxTokens: 2048 },
  );

  return summaryResponse.trim();
}
