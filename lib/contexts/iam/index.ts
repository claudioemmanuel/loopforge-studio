/**
 * IAM Context Module
 *
 * Identity & Access Management bounded context.
 * Handles user authentication, provider API keys, and preferences.
 */

// Public API
export * from "./api";

// Domain exports (for advanced usage)
export * from "./domain/events";
export type {
  EncryptedApiKey,
  ProviderConfig,
  UserProviderConfiguration,
} from "./domain/provider-config";
export {
  DEFAULT_MODELS,
  hasValidApiKey,
  getActiveProviderConfig,
  hasAtLeastOneProvider,
} from "./domain/provider-config";
export { UserAggregate } from "./domain/user-aggregate";

// Application exports
export { UserService } from "./application/user-service";

// Infrastructure exports
export * from "./infrastructure/crypto";
export { UserRepository } from "./infrastructure/user-repository";
