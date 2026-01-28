/**
 * Database Transactions - Atomic operations with retry logic
 * Provides utilities for safe, transactional database operations
 */

import { db } from "./index";

// Error codes that indicate retryable errors
const RETRYABLE_ERROR_CODES = [
  "40001", // serialization_failure
  "40P01", // deadlock_detected
  "55P03", // lock_not_available
  "57014", // query_canceled
];

// Error codes that should not be retried
const NON_RETRYABLE_ERROR_CODES = [
  "23505", // unique_violation
  "23503", // foreign_key_violation
  "23502", // not_null_violation
  "23514", // check_violation
];

export interface TransactionOptions {
  name?: string;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  timeout?: number;
  idempotencyKey?: string;
}

export interface TransactionResult<T> {
  success: boolean;
  data?: T;
  error?: TransactionError;
  retryCount: number;
  durationMs: number;
}

export class TransactionError extends Error {
  code: string;
  isRetryable: boolean;
  originalError: unknown;

  constructor(
    message: string,
    code: string,
    isRetryable: boolean,
    originalError: unknown,
  ) {
    super(message);
    this.name = "TransactionError";
    this.code = code;
    this.isRetryable = isRetryable;
    this.originalError = originalError;
  }
}

// Simple in-memory cache for idempotency
const idempotencyCache = new Map<
  string,
  { result: unknown; timestamp: number }
>();
const IDEMPOTENCY_TTL = 15 * 60 * 1000; // 15 minutes

/**
 * Run a callback in a transaction with automatic retry on deadlock
 */
export async function withTransaction<T>(
  callback: (tx: typeof db) => Promise<T>,
  options: TransactionOptions = {},
): Promise<TransactionResult<T>> {
  const {
    name = "unnamed-tx",
    maxRetries = 3,
    baseDelayMs = 10,
    maxDelayMs = 1000,
    timeout,
    idempotencyKey,
  } = options;

  const startTime = Date.now();

  // Check idempotency cache
  if (idempotencyKey) {
    const cached = idempotencyCache.get(idempotencyKey);
    if (cached && Date.now() - cached.timestamp < IDEMPOTENCY_TTL) {
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "info",
          message: "Returning cached result for idempotency key",
          name,
          idempotencyKey,
        }),
      );
      return {
        success: true,
        data: cached.result as T,
        retryCount: 0,
        durationMs: Date.now() - startTime,
      };
    }
  }

  let lastError: TransactionError | undefined;
  let retryCount = 0;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "debug",
        message: `Starting transaction attempt ${attempt}/${maxRetries + 1}`,
        name,
        isolationLevel: "read committed",
      }),
    );

    try {
      // Execute the transaction
      const result = await executeWithTimeout(
        () => db.transaction(callback),
        timeout,
      );

      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "info",
          message: "Transaction completed successfully",
          name,
          attempt,
          durationMs: Date.now() - startTime,
        }),
      );

      // Cache the result for idempotency
      if (idempotencyKey) {
        idempotencyCache.set(idempotencyKey, {
          result,
          timestamp: Date.now(),
        });
      }

      return {
        success: true,
        data: result,
        retryCount,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      const txError = categorizeError(error);
      lastError = txError;

      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "warn",
          message: txError.message,
          name,
          errorCode: txError.code,
          isRetryable: txError.isRetryable,
        }),
      );

      if (!txError.isRetryable || attempt > maxRetries) {
        break;
      }

      retryCount++;

      // Calculate exponential backoff with jitter
      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * baseDelayMs,
        maxDelayMs,
      );

      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "debug",
          message: `Retrying transaction after ${delay}ms`,
          name,
          delay,
        }),
      );

      await sleep(delay);
    }
  }

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      message: "Transaction failed after all retries",
      name,
      errorCode: lastError?.code,
      retryCount,
      durationMs: Date.now() - startTime,
    }),
  );

  return {
    success: false,
    error: lastError,
    retryCount,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Run a transaction and throw on failure
 */
export async function runTransaction<T>(
  callback: (tx: typeof db) => Promise<T>,
  options: TransactionOptions = {},
): Promise<T> {
  const result = await withTransaction(callback, options);

  if (!result.success) {
    throw result.error ?? new Error("Transaction failed");
  }

  return result.data as T;
}

/**
 * Execute multiple operations atomically
 */
export async function atomicOperations<T>(
  operations: Array<(tx: typeof db) => Promise<unknown>>,
  options: TransactionOptions = {},
): Promise<TransactionResult<T[]>> {
  return withTransaction(async (tx) => {
    const results: unknown[] = [];
    for (const op of operations) {
      results.push(await op(tx));
    }
    return results as T[];
  }, options);
}

/**
 * Execute a compensation action (rollback) with extra retries
 */
export async function executeCompensation<T>(
  action: string,
  callback: (tx: typeof db) => Promise<T>,
  options: Omit<TransactionOptions, "maxRetries"> = {},
): Promise<TransactionResult<T>> {
  return withTransaction(callback, {
    ...options,
    name: `compensation:${action}`,
    maxRetries: 5, // More retries for compensations
  });
}

/**
 * Categorize an error as retryable or not
 */
function categorizeError(error: unknown): TransactionError {
  if (error instanceof TransactionError) {
    return error;
  }

  const errorObj = error as { code?: string; message?: string };
  const code = errorObj.code ?? "UNKNOWN";
  const message = errorObj.message ?? "Unknown error";

  // Check if it's a known retryable error
  const isRetryable = RETRYABLE_ERROR_CODES.includes(code);

  // Check if it's explicitly non-retryable
  if (NON_RETRYABLE_ERROR_CODES.includes(code)) {
    return new TransactionError(message, code, false, error);
  }

  // Timeout errors
  if (message.includes("timeout") || code === "TIMEOUT") {
    return new TransactionError("Transaction timeout", "TIMEOUT", false, error);
  }

  // Deadlock errors
  if (message.includes("deadlock") || code === "DEADLOCK") {
    return new TransactionError("deadlock detected", "DEADLOCK", true, error);
  }

  return new TransactionError(message, code, isRetryable, error);
}

/**
 * Execute a function with a timeout
 */
async function executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs?: number,
): Promise<T> {
  if (!timeoutMs) {
    return fn();
  }

  return Promise.race([
    fn(),
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(
          new TransactionError("Transaction timeout", "TIMEOUT", false, null),
        );
      }, timeoutMs);
    }),
  ]);
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Clean up old entries from the idempotency cache
 */
export function cleanIdempotencyCache(): void {
  const now = Date.now();
  for (const [key, value] of idempotencyCache.entries()) {
    if (now - value.timestamp > IDEMPOTENCY_TTL) {
      idempotencyCache.delete(key);
    }
  }
}

// Clean up cache periodically
setInterval(cleanIdempotencyCache, 5 * 60 * 1000); // Every 5 minutes
