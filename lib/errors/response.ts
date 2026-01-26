import { NextResponse } from "next/server";
import { APIError, Errors } from "./api-error";
import type { APIErrorResponse } from "./types";
import { apiLogger } from "@/lib/logger";

/**
 * Create a NextResponse from an APIError
 */
export function errorResponse(error: APIError): NextResponse<APIErrorResponse> {
  return NextResponse.json(error.toJSON(), { status: error.statusCode });
}

/**
 * Handle any error and convert to standardized APIError response
 * Use this in catch blocks of API routes
 */
export function handleError(error: unknown): NextResponse<APIErrorResponse> {
  // If already an APIError, use it directly
  if (error instanceof APIError) {
    apiLogger.error(
      {
        code: error.code,
        message: error.message,
        provider: error.provider,
        originalError: error.originalError,
      },
      "API error",
    );
    return errorResponse(error);
  }

  // Log the original error for debugging
  apiLogger.error({ error }, "Unhandled error");

  // Convert to generic server error
  const apiError = Errors.serverError(error);
  return errorResponse(apiError);
}

/**
 * Type guard to check if an error is an APIError
 */
export function isAPIError(error: unknown): error is APIError {
  return error instanceof APIError;
}
