// Types
export type {
  ErrorCode,
  ErrorSeverity,
  RateLimitInfo,
  ErrorAction,
  APIErrorResponse,
  ErrorData,
  ProviderErrorPattern,
} from "./types";
export { PROVIDER_DISPLAY_NAMES } from "./types";

// APIError class and factory
export { APIError, Errors } from "./api-error";

// Provider-specific parsers
export {
  parseOpenAIError,
  parseAnthropicError,
  parseGeminiError,
  parseProviderError,
} from "./provider-errors";

// Response utilities
export { errorResponse, handleError, isAPIError } from "./response";
