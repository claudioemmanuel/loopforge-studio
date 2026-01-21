import type { AiProvider } from "@/lib/db/schema";
import { APIError, Errors } from "./api-error";

/**
 * Extract retry-after seconds from various header/error formats
 */
function extractRetryAfter(error: unknown): number {
  // Check for retry-after in headers (if available)
  if (error && typeof error === "object") {
    const err = error as Record<string, unknown>;

    // Check headers object
    if (err.headers && typeof err.headers === "object") {
      const headers = err.headers as Record<string, string>;
      const retryAfter =
        headers["retry-after"] ||
        headers["Retry-After"] ||
        headers["x-ratelimit-reset-requests"];
      if (retryAfter) {
        const seconds = parseInt(retryAfter, 10);
        if (!isNaN(seconds)) return seconds;
      }
    }

    // Check error body/message for retry info
    if (err.error && typeof err.error === "object") {
      const errorBody = err.error as Record<string, unknown>;
      if (typeof errorBody.retry_after === "number") {
        return errorBody.retry_after;
      }
    }

    // Check message for "try again in X seconds" pattern
    const message = err.message || err.error_message || "";
    if (typeof message === "string") {
      const match = message.match(/try again in (\d+)/i);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
  }

  // Default retry after
  return 60;
}

/**
 * Parse OpenAI SDK errors
 */
export function parseOpenAIError(error: unknown): APIError {
  const provider: AiProvider = "openai";

  // Handle OpenAI SDK errors
  if (error && typeof error === "object") {
    const err = error as Record<string, unknown>;
    const status = err.status || err.statusCode;
    const code = err.code;
    const type = err.type;
    const message = String(err.message || "");

    // Rate limit (429)
    if (
      status === 429 ||
      code === "rate_limit_exceeded" ||
      type === "rate_limit_error"
    ) {
      return Errors.rateLimit(provider, extractRetryAfter(error), error);
    }

    // Authentication error (401)
    if (
      status === 401 ||
      code === "invalid_api_key" ||
      type === "authentication_error"
    ) {
      return Errors.authError(provider, error);
    }

    // Quota exceeded (402 / insufficient_quota)
    if (
      status === 402 ||
      code === "insufficient_quota" ||
      message.toLowerCase().includes("quota")
    ) {
      return Errors.quotaExceeded(provider, error);
    }

    // Content filtered
    if (
      code === "content_policy_violation" ||
      message.toLowerCase().includes("content policy")
    ) {
      return Errors.contentFiltered(provider, error);
    }

    // Model overloaded (503)
    if (
      status === 503 ||
      code === "model_overloaded" ||
      message.toLowerCase().includes("overloaded")
    ) {
      return Errors.modelOverloaded(provider, error);
    }

    // Server errors (5xx)
    if (typeof status === "number" && status >= 500) {
      return Errors.serverError(error);
    }
  }

  // Network errors
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return Errors.networkError(error);
  }

  return Errors.unknown(provider, error);
}

/**
 * Parse Anthropic SDK errors
 */
export function parseAnthropicError(error: unknown): APIError {
  const provider: AiProvider = "anthropic";

  if (error && typeof error === "object") {
    const err = error as Record<string, unknown>;
    const status = err.status || err.statusCode;
    const errorType = err.type || err.error_type;
    const message = String(err.message || "");

    // Also check nested error object (Anthropic SDK structure)
    let nestedType: unknown;
    if (err.error && typeof err.error === "object") {
      const nested = err.error as Record<string, unknown>;
      nestedType = nested.type;
    }
    const type = errorType || nestedType;

    // Rate limit
    if (status === 429 || type === "rate_limit_error") {
      return Errors.rateLimit(provider, extractRetryAfter(error), error);
    }

    // Authentication error
    if (status === 401 || type === "authentication_error") {
      return Errors.authError(provider, error);
    }

    // Invalid API key
    if (type === "invalid_api_key") {
      return Errors.authError(provider, error);
    }

    // Quota/billing
    if (
      type === "billing_error" ||
      message.toLowerCase().includes("billing") ||
      message.toLowerCase().includes("quota")
    ) {
      return Errors.quotaExceeded(provider, error);
    }

    // Content filtered
    if (
      type === "content_filtering_error" ||
      message.toLowerCase().includes("content")
    ) {
      return Errors.contentFiltered(provider, error);
    }

    // Overloaded
    if (status === 529 || type === "overloaded_error") {
      return Errors.modelOverloaded(provider, error);
    }

    // Server errors
    if (typeof status === "number" && status >= 500) {
      return Errors.serverError(error);
    }
  }

  // Network errors
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return Errors.networkError(error);
  }

  return Errors.unknown(provider, error);
}

/**
 * Parse Google Gemini SDK errors
 */
export function parseGeminiError(error: unknown): APIError {
  const provider: AiProvider = "gemini";

  if (error && typeof error === "object") {
    const err = error as Record<string, unknown>;
    const status = err.status || err.statusCode || err.code;
    const message = String(err.message || err.error_message || "");
    const errorDetails = err.errorDetails;

    // Check for Google-style error codes in message
    const upperMessage = message.toUpperCase();

    // Rate limit
    if (
      status === 429 ||
      upperMessage.includes("RATE_LIMIT") ||
      upperMessage.includes("RESOURCE_EXHAUSTED")
    ) {
      return Errors.rateLimit(provider, extractRetryAfter(error), error);
    }

    // Authentication error
    if (
      status === 401 ||
      status === 403 ||
      upperMessage.includes("API_KEY_INVALID") ||
      upperMessage.includes("PERMISSION_DENIED") ||
      upperMessage.includes("INVALID_API_KEY")
    ) {
      return Errors.authError(provider, error);
    }

    // Quota exceeded
    if (
      status === 402 ||
      upperMessage.includes("QUOTA_EXCEEDED") ||
      upperMessage.includes("BILLING")
    ) {
      return Errors.quotaExceeded(provider, error);
    }

    // Content filtered (safety)
    if (
      upperMessage.includes("SAFETY") ||
      upperMessage.includes("BLOCKED") ||
      upperMessage.includes("HARM_CATEGORY")
    ) {
      return Errors.contentFiltered(provider, error);
    }

    // Model overloaded
    if (
      status === 503 ||
      upperMessage.includes("OVERLOADED") ||
      upperMessage.includes("UNAVAILABLE")
    ) {
      return Errors.modelOverloaded(provider, error);
    }

    // Check errorDetails array for more specific errors
    if (Array.isArray(errorDetails)) {
      for (const detail of errorDetails) {
        if (detail && typeof detail === "object") {
          const d = detail as Record<string, unknown>;
          const reason = String(d.reason || "").toUpperCase();
          if (reason.includes("RATE_LIMIT")) {
            return Errors.rateLimit(provider, extractRetryAfter(error), error);
          }
          if (reason.includes("API_KEY")) {
            return Errors.authError(provider, error);
          }
        }
      }
    }

    // Server errors
    if (typeof status === "number" && status >= 500) {
      return Errors.serverError(error);
    }
  }

  // Network errors
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return Errors.networkError(error);
  }

  return Errors.unknown(provider, error);
}

/**
 * Universal error parser - routes to appropriate provider parser
 */
export function parseProviderError(
  error: unknown,
  provider: AiProvider
): APIError {
  switch (provider) {
    case "openai":
      return parseOpenAIError(error);
    case "anthropic":
      return parseAnthropicError(error);
    case "gemini":
      return parseGeminiError(error);
    default:
      return Errors.unknown(provider, error);
  }
}
