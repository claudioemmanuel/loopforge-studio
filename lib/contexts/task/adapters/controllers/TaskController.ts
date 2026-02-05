/**
 * Task Controller - HTTP adapter for task operations
 *
 * Handles HTTP requests, delegates to use cases, and formats responses.
 * Use case methods will be injected via constructor in Step 4.
 */

import { NextResponse } from "next/server";
import {
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  BusinessRuleError,
  UseCaseError,
} from "@/lib/shared/errors";

export class TaskController {
  constructor() // Use cases will be injected here in Step 4
  // Example: private readonly createTask: CreateTaskUseCase,
  {}

  /**
   * Handle use case errors and map to HTTP responses
   */
  protected handleError(error: UseCaseError): NextResponse {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        {
          error: error.message,
          details: error.validationErrors,
          code: error.code,
        },
        { status: 400 },
      );
    }

    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 404 },
      );
    }

    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 403 },
      );
    }

    if (error instanceof BusinessRuleError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 422 },
      );
    }

    // Generic error fallback
    console.error("Use case error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }

  /**
   * Handle unexpected errors
   */
  protected handleUnexpectedError(error: unknown): NextResponse {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }

  // Controller methods will be added in Step 4
  // Example:
  // async create(req: NextRequest, repoId: string): Promise<NextResponse> { ... }
  // async getById(req: NextRequest, taskId: string): Promise<NextResponse> { ... }
}
