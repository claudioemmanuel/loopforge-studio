import { NextResponse } from "next/server";
import { APIError, Errors } from "./api-error";
import type { APIErrorResponse } from "./types";

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
    console.error(`[API Error] ${error.code}: ${error.message}`, {
      provider: error.provider,
      originalError: error.originalError,
    });
    return errorResponse(error);
  }

  // Log the original error for debugging
  console.error("[Unhandled Error]", error);

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
