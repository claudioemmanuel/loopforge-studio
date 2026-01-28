"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ErrorCode, ErrorAction } from "@/lib/errors/types";

export interface ParsedAPIError {
  code: ErrorCode;
  message: string;
  provider?: string;
  action?: ErrorAction;
  retryAfter?: number;
}

export interface UseAPIErrorReturn {
  /** Current error state */
  error: ParsedAPIError | null;
  /** Countdown seconds remaining for rate limits */
  retryCountdown: number;
  /** Whether the current error is a rate limit error */
  isRateLimitError: boolean;
  /** Whether the current error is an API key error */
  isApiKeyError: boolean;
  /** Whether the current error requires settings navigation */
  requiresSettings: boolean;
  /** Clear the current error */
  clearError: () => void;
  /** Set an error manually */
  setError: (error: ParsedAPIError) => void;
  /** Parse an API response and handle errors. Returns true if error was found. */
  handleAPIResponse: (response: Response) => Promise<boolean>;
  /** Parse error data directly */
  handleErrorData: (data: unknown) => boolean;
}

/**
 * Hook for handling API errors with rate limit countdown support
 */
export function useAPIError(): UseAPIErrorReturn {
  const [error, setErrorState] = useState<ParsedAPIError | null>(null);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Clear countdown on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

  // Start countdown when retry is needed
  useEffect(() => {
    if (error?.retryAfter && error.retryAfter > 0) {
      setRetryCountdown(error.retryAfter);

      countdownRef.current = setInterval(() => {
        setRetryCountdown((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) {
              clearInterval(countdownRef.current);
              countdownRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
      };
    }
  }, [error?.retryAfter]);

  const clearError = useCallback(() => {
    setErrorState(null);
    setRetryCountdown(0);
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const setError = useCallback((newError: ParsedAPIError) => {
    setErrorState(newError);
  }, []);

  const handleErrorData = useCallback((data: unknown): boolean => {
    if (!data || typeof data !== "object") {
      return false;
    }

    const responseData = data as Record<string, unknown>;

    // Check for standardized error format
    if (responseData.error && typeof responseData.error === "object") {
      const errorObj = responseData.error as Record<string, unknown>;
      const parsed: ParsedAPIError = {
        code: (errorObj.code as ErrorCode) || "UNKNOWN",
        message: (errorObj.message as string) || "An error occurred",
        provider: errorObj.provider as string | undefined,
        action: errorObj.action as ErrorAction | undefined,
        retryAfter:
          (errorObj.rateLimitInfo as { retryAfter?: number })?.retryAfter ||
          (errorObj.action as ErrorAction)?.retryAfter,
      };
      setErrorState(parsed);
      return true;
    }

    // Handle legacy error format (just { error: string })
    if (typeof responseData.error === "string") {
      const parsed: ParsedAPIError = {
        code: "UNKNOWN",
        message: responseData.error,
      };
      setErrorState(parsed);
      return true;
    }

    return false;
  }, []);

  const handleAPIResponse = useCallback(
    async (response: Response): Promise<boolean> => {
      if (response.ok) {
        return false;
      }

      try {
        const data = await response.json();
        return handleErrorData(data);
      } catch {
        // Failed to parse response, create generic error
        setErrorState({
          code: "UNKNOWN",
          message: `Request failed with status ${response.status}`,
        });
        return true;
      }
    },
    [handleErrorData],
  );

  const isRateLimitError = error?.code === "RATE_LIMIT";
  const isApiKeyError =
    error?.code === "AUTH_ERROR" || error?.code === "NO_PROVIDER_CONFIGURED";
  const requiresSettings = Boolean(
    error?.action?.type === "link" && error.action.href?.includes("/settings"),
  );

  return {
    error,
    retryCountdown,
    isRateLimitError,
    isApiKeyError,
    requiresSettings,
    clearError,
    setError,
    handleAPIResponse,
    handleErrorData,
  };
}
