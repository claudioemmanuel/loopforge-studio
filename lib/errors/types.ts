import type { AiProvider } from "@/lib/db/schema";

/**
 * Standardized error codes for consistent error handling across the application
 */
export type ErrorCode =
  | "RATE_LIMIT"
  | "AUTH_ERROR"
  | "QUOTA_EXCEEDED"
  | "NETWORK_ERROR"
  | "SERVER_ERROR"
  | "NO_PROVIDER_CONFIGURED"
  | "INVALID_REQUEST"
  | "CONTENT_FILTERED"
  | "MODEL_OVERLOADED"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "UNKNOWN";

/**
 * Error severity levels
 */
export type ErrorSeverity = "warning" | "error" | "critical";

/**
 * Rate limit information extracted from provider responses
 */
export interface RateLimitInfo {
  /** Seconds until the rate limit resets */
  retryAfter: number;
  /** Request limit (if available) */
  limit?: number;
  /** Remaining requests (if available) */
  remaining?: number;
  /** Unix timestamp when the rate limit resets */
  resetAt?: number;
}

/**
 * Action the user can take to resolve the error
 */
export interface ErrorAction {
  /** Button label */
  label: string;
  /** Type of action */
  type: "link" | "retry" | "dismiss";
  /** URL for link type actions */
  href?: string;
  /** Seconds to wait before retry */
  retryAfter?: number;
}

/**
 * Standardized API error response format
 */
export interface APIErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    provider?: AiProvider;
    severity: ErrorSeverity;
    action?: ErrorAction;
    rateLimitInfo?: RateLimitInfo;
    /** Technical details - only included in development */
    details?: string;
  };
}

/**
 * Internal error data structure
 */
export interface ErrorData {
  code: ErrorCode;
  message: string;
  statusCode: number;
  provider?: AiProvider;
  severity: ErrorSeverity;
  action?: ErrorAction;
  rateLimitInfo?: RateLimitInfo;
  originalError?: unknown;
}

/**
 * Provider-specific error patterns
 */
export interface ProviderErrorPattern {
  /** Pattern to match against error message or type */
  pattern: RegExp | string;
  /** Resulting error code */
  code: ErrorCode;
  /** User-friendly message template (use {provider} for provider name) */
  message: string;
  /** HTTP status code to return */
  statusCode: number;
  /** Severity level */
  severity: ErrorSeverity;
  /** Optional action */
  action?: Omit<ErrorAction, "retryAfter">;
}

/**
 * Provider display names for user-friendly messages
 */
export const PROVIDER_DISPLAY_NAMES: Record<AiProvider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  gemini: "Google Gemini",
};
