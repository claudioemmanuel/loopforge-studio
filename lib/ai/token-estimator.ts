/**
 * Token estimation utilities for AI providers
 * Provides pre-call token estimation for cost tracking and analytics
 */

import type { AiProvider } from "@/lib/db/schema/types";

// Approximate token-to-character ratios by provider
// OpenAI: ~4 chars per token (using tiktoken internally if available)
// Anthropic: ~3.5 chars per token (character approximation)
// Gemini: ~4 chars per token (character approximation)
const CHAR_PER_TOKEN: Record<AiProvider, number> = {
  openai: 4,
  anthropic: 3.5,
  gemini: 4,
};

// Pricing in cents per million tokens (as of 2026-01-29)
// These are approximate - actual pricing varies by model tier
const PRICING_PER_MILLION: Record<string, { input: number; output: number }> = {
  // Anthropic
  "claude-sonnet-4-20250514": { input: 300, output: 1500 },
  "claude-opus-4-20241113": { input: 1500, output: 7500 },
  "claude-haiku-3-5-20241022": { input: 80, output: 400 },
  // OpenAI
  "gpt-4o": { input: 500, output: 1500 },
  "gpt-4-turbo": { input: 1000, output: 3000 },
  "gpt-4o-mini": { input: 15, output: 60 },
  // Google Gemini
  "gemini-2.5-pro": { input: 125, output: 500 },
  "gemini-2.5-flash": { input: 10, output: 30 },
  "gemini-2.0-flash": { input: 10, output: 30 },
};

/**
 * Estimate token count for a given text
 * Uses provider-specific character approximations
 *
 * @param text - The text to estimate tokens for
 * @param provider - The AI provider (affects char-per-token ratio)
 * @returns Estimated token count
 */
export function estimateTokenCount(text: string, provider: AiProvider): number {
  const charCount = text.length;
  const charsPerToken = CHAR_PER_TOKEN[provider];
  return Math.ceil(charCount / charsPerToken);
}

/**
 * Estimate token count for an array of messages
 * Includes overhead for message structure (role, content wrappers)
 *
 * @param messages - Array of chat messages
 * @param provider - The AI provider
 * @returns Estimated total input token count
 */
export function estimateMessagesTokenCount(
  messages: Array<{ role: string; content: string }>,
  provider: AiProvider,
): number {
  // Add ~4 tokens overhead per message for role and structure
  const OVERHEAD_PER_MESSAGE = 4;

  let totalTokens = 0;
  for (const message of messages) {
    const contentTokens = estimateTokenCount(message.content, provider);
    totalTokens += contentTokens + OVERHEAD_PER_MESSAGE;
  }

  return totalTokens;
}

/**
 * Calculate estimated cost for token usage
 * Returns cost in cents (USD)
 *
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @param model - The specific model used
 * @returns Estimated cost in cents
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  model: string,
): number {
  const pricing = PRICING_PER_MILLION[model];

  if (!pricing) {
    // Unknown model - use generic high estimate
    console.warn(`Unknown model pricing for: ${model}, using generic estimate`);
    return Math.ceil((inputTokens * 300 + outputTokens * 1500) / 1_000_000);
  }

  const inputCost = (inputTokens * pricing.input) / 1_000_000;
  const outputCost = (outputTokens * pricing.output) / 1_000_000;

  return Math.ceil(inputCost + outputCost);
}

/**
 * Get token-to-character ratio for a provider
 * Useful for UI estimates and validation
 */
export function getCharPerToken(provider: AiProvider): number {
  return CHAR_PER_TOKEN[provider];
}

/**
 * Get pricing information for a model
 * Returns null if model pricing is unknown
 */
export function getModelPricing(
  model: string,
): { input: number; output: number } | null {
  return PRICING_PER_MILLION[model] || null;
}
