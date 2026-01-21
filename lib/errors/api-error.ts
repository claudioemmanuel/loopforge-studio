import type { AiProvider } from "@/lib/db/schema";
import type {
  ErrorCode,
  ErrorSeverity,
  ErrorAction,
  RateLimitInfo,
  APIErrorResponse,
  ErrorData,
} from "./types";
import { PROVIDER_DISPLAY_NAMES } from "./types";

/**
 * Standardized API Error class for consistent error handling
 */
export class APIError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly provider?: AiProvider;
  readonly severity: ErrorSeverity;
  readonly action?: ErrorAction;
  readonly rateLimitInfo?: RateLimitInfo;
  readonly originalError?: unknown;

  constructor(data: ErrorData) {
    super(data.message);
    this.name = "APIError";
    this.code = data.code;
    this.statusCode = data.statusCode;
    this.provider = data.provider;
    this.severity = data.severity;
    this.action = data.action;
    this.rateLimitInfo = data.rateLimitInfo;
    this.originalError = data.originalError;
  }

  /**
   * Convert to JSON response format
   */
  toJSON(): APIErrorResponse {
    const response: APIErrorResponse = {
      error: {
        code: this.code,
        message: this.message,
        severity: this.severity,
      },
    };

    if (this.provider) {
      response.error.provider = this.provider;
    }

    if (this.action) {
      response.error.action = this.action;
    }

    if (this.rateLimitInfo) {
      response.error.rateLimitInfo = this.rateLimitInfo;
    }

    // Include technical details only in development
    if (process.env.NODE_ENV === "development" && this.originalError) {
      response.error.details =
        this.originalError instanceof Error
          ? this.originalError.message
          : String(this.originalError);
    }

    return response;
  }
}

/**
 * Factory functions for creating common error types
 */
export const Errors = {
  /**
   * Rate limit error with countdown
   */
  rateLimit(
    provider: AiProvider,
    retryAfter: number = 60,
    originalError?: unknown
  ): APIError {
    const displayName = PROVIDER_DISPLAY_NAMES[provider];
    return new APIError({
      code: "RATE_LIMIT",
      message: `Rate limited by ${displayName}. Try again in ${retryAfter} seconds.`,
      statusCode: 429,
      provider,
      severity: "warning",
      action: {
        label: "Retry",
        type: "retry",
        retryAfter,
      },
      rateLimitInfo: {
        retryAfter,
      },
      originalError,
    });
  },

  /**
   * Authentication/API key error
   */
  authError(provider: AiProvider, originalError?: unknown): APIError {
    const displayName = PROVIDER_DISPLAY_NAMES[provider];
    return new APIError({
      code: "AUTH_ERROR",
      message: `Invalid ${displayName} API key. Please check your settings.`,
      statusCode: 401,
      provider,
      severity: "error",
      action: {
        label: "Configure API Key",
        type: "link",
        href: "/settings/integrations",
      },
      originalError,
    });
  },

  /**
   * Quota/billing exceeded error
   */
  quotaExceeded(provider: AiProvider, originalError?: unknown): APIError {
    const displayName = PROVIDER_DISPLAY_NAMES[provider];
    const dashboardUrls: Record<AiProvider, string> = {
      openai: "https://platform.openai.com/account/billing",
      anthropic: "https://console.anthropic.com/settings/billing",
      gemini: "https://console.cloud.google.com/billing",
    };
    return new APIError({
      code: "QUOTA_EXCEEDED",
      message: `Your ${displayName} quota has been exceeded. Please check your plan.`,
      statusCode: 402,
      provider,
      severity: "error",
      action: {
        label: "Check Billing",
        type: "link",
        href: dashboardUrls[provider],
      },
      originalError,
    });
  },

  /**
   * Network/connection error
   */
  networkError(originalError?: unknown): APIError {
    return new APIError({
      code: "NETWORK_ERROR",
      message: "Connection failed. Please check your internet connection.",
      statusCode: 503,
      severity: "error",
      action: {
        label: "Retry",
        type: "retry",
      },
      originalError,
    });
  },

  /**
   * No AI provider configured
   */
  noProviderConfigured(): APIError {
    return new APIError({
      code: "NO_PROVIDER_CONFIGURED",
      message: "No AI provider configured. Please add an API key in settings.",
      statusCode: 400,
      severity: "error",
      action: {
        label: "Add API Key",
        type: "link",
        href: "/settings/integrations",
      },
    });
  },

  /**
   * Generic server error
   */
  serverError(originalError?: unknown): APIError {
    return new APIError({
      code: "SERVER_ERROR",
      message: "Something went wrong. Please try again.",
      statusCode: 500,
      severity: "error",
      action: {
        label: "Retry",
        type: "retry",
      },
      originalError,
    });
  },

  /**
   * Content filtered by provider
   */
  contentFiltered(provider: AiProvider, originalError?: unknown): APIError {
    const displayName = PROVIDER_DISPLAY_NAMES[provider];
    return new APIError({
      code: "CONTENT_FILTERED",
      message: `Your request was filtered by ${displayName}'s safety system. Please rephrase your input.`,
      statusCode: 400,
      provider,
      severity: "warning",
      action: {
        label: "Dismiss",
        type: "dismiss",
      },
      originalError,
    });
  },

  /**
   * Model overloaded
   */
  modelOverloaded(provider: AiProvider, originalError?: unknown): APIError {
    const displayName = PROVIDER_DISPLAY_NAMES[provider];
    return new APIError({
      code: "MODEL_OVERLOADED",
      message: `${displayName} is currently overloaded. Please try again in a moment.`,
      statusCode: 503,
      provider,
      severity: "warning",
      action: {
        label: "Retry",
        type: "retry",
        retryAfter: 30,
      },
      originalError,
    });
  },

  /**
   * Invalid request
   */
  invalidRequest(message: string, originalError?: unknown): APIError {
    return new APIError({
      code: "INVALID_REQUEST",
      message,
      statusCode: 400,
      severity: "error",
      originalError,
    });
  },

  /**
   * Unknown error - fallback
   */
  unknown(provider?: AiProvider, originalError?: unknown): APIError {
    return new APIError({
      code: "UNKNOWN",
      message: "An unexpected error occurred. Please try again.",
      statusCode: 500,
      provider,
      severity: "error",
      action: {
        label: "Retry",
        type: "retry",
      },
      originalError,
    });
  },
};
