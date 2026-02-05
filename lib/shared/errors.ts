/**
 * Clean Architecture error hierarchy for use cases.
 *
 * These errors are domain-level errors used by use cases and entities.
 * They are separate from the existing lib/errors/ (HTTP/API-specific errors).
 *
 * Use cases return Result<T, UseCaseError> instead of throwing.
 * Controllers map UseCaseError subtypes to HTTP status codes.
 */

export abstract class UseCaseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends UseCaseError {
  constructor(
    public readonly validationErrors: Record<string, string[]>,
    message: string = "Validation failed",
  ) {
    super(message, "VALIDATION_ERROR");
  }
}

export class NotFoundError extends UseCaseError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`, "NOT_FOUND");
  }
}

export class UnauthorizedError extends UseCaseError {
  constructor(message: string = "Unauthorized access") {
    super(message, "UNAUTHORIZED");
  }
}

export class BusinessRuleError extends UseCaseError {
  constructor(rule: string, message: string) {
    super(
      `Business rule violated: ${rule}. ${message}`,
      "BUSINESS_RULE_VIOLATION",
    );
  }
}

export class RepositoryError extends UseCaseError {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message, "REPOSITORY_ERROR");
  }
}

export class PublisherError extends UseCaseError {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message, "PUBLISHER_ERROR");
  }
}

export class ExternalServiceError extends UseCaseError {
  constructor(
    service: string,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(
      `External service error (${service}): ${message}`,
      "EXTERNAL_SERVICE_ERROR",
    );
  }
}
