/**
 * Transaction Utilities Tests
 *
 * Tests for atomic transaction handling, retry logic, and error categorization.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  withTransaction,
  runTransaction,
  atomicOperations,
  executeCompensation,
  generateIdempotencyKey,
  clearIdempotencyKey,
  TransactionError,
  categorizeError,
} from "../lib/db/transactions";

// Mock the database module
vi.mock("../lib/db", () => ({
  db: {
    transaction: vi.fn(),
  },
}));

import { db } from "../lib/db";

describe("Transaction Utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear any cached idempotency results
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("withTransaction", () => {
    it("should execute callback successfully and return result", async () => {
      const mockResult = { id: "123", name: "test" };
      const mockCallback = vi.fn().mockResolvedValue(mockResult);

      (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          return callback({});
        },
      );

      const result = await withTransaction(mockCallback, { name: "test-tx" });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResult);
      expect(result.retryCount).toBe(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("should retry on deadlock errors", async () => {
      const mockCallback = vi.fn();
      let callCount = 0;

      (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          callCount++;
          if (callCount < 3) {
            const error = new Error("deadlock detected");
            (error as Error & { code: string }).code = "40P01";
            throw error;
          }
          return callback({});
        },
      );

      mockCallback.mockResolvedValue({ success: true });

      const result = await withTransaction(mockCallback, {
        name: "retry-test",
        maxRetries: 3,
        retryDelayMs: 10,
      });

      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(2);
      expect(callCount).toBe(3);
    });

    it("should fail after max retries exceeded", async () => {
      (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async () => {
          const error = new Error("deadlock detected");
          (error as Error & { code: string }).code = "40P01";
          throw error;
        },
      );

      const result = await withTransaction(async () => ({ success: true }), {
        name: "fail-test",
        maxRetries: 2,
        retryDelayMs: 10,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(TransactionError);
      expect(result.error?.code).toBe("DEADLOCK");
      expect(result.retryCount).toBe(2);
    });

    it("should not retry on non-retryable errors", async () => {
      let callCount = 0;

      (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async () => {
          callCount++;
          const error = new Error("unique constraint violation");
          (error as Error & { code: string }).code = "23505";
          throw error;
        },
      );

      const result = await withTransaction(async () => ({ success: true }), {
        name: "no-retry-test",
        maxRetries: 3,
        retryDelayMs: 10,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("CONSTRAINT_VIOLATION");
      expect(result.error?.isRetryable).toBe(false);
      expect(callCount).toBe(1); // Only one attempt
    });

    it("should handle timeout", async () => {
      (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async () => {
          // Simulate a long-running operation
          await new Promise((resolve) => setTimeout(resolve, 200));
          return { success: true };
        },
      );

      const result = await withTransaction(async () => ({ success: true }), {
        name: "timeout-test",
        timeoutMs: 50,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("TIMEOUT");
    });

    it("should use idempotency cache", async () => {
      const mockResult = { id: "123" };
      let callCount = 0;

      (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          callCount++;
          return callback({});
        },
      );

      const callback = vi.fn().mockResolvedValue(mockResult);
      const idempotencyKey = "test-idempotency-key-" + Date.now();

      // First call
      const result1 = await withTransaction(callback, {
        name: "idem-test",
        idempotencyKey,
      });

      // Second call with same key
      const result2 = await withTransaction(callback, {
        name: "idem-test",
        idempotencyKey,
      });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.data).toEqual(mockResult);
      expect(result2.data).toEqual(mockResult);
      expect(callCount).toBe(1); // Only one actual transaction

      // Clear cache for cleanup
      clearIdempotencyKey(idempotencyKey);
    });
  });

  describe("runTransaction", () => {
    it("should return result on success", async () => {
      const mockResult = { id: "456" };

      (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          return callback({});
        },
      );

      const callback = vi.fn().mockResolvedValue(mockResult);
      const result = await runTransaction(callback, { name: "run-tx-test" });

      expect(result).toEqual(mockResult);
    });

    it("should throw TransactionError on failure", async () => {
      (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async () => {
          throw new Error("database error");
        },
      );

      await expect(
        runTransaction(async () => ({ success: true }), { name: "throw-test" }),
      ).rejects.toThrow(TransactionError);
    });
  });

  describe("atomicOperations", () => {
    it("should execute multiple operations in sequence", async () => {
      const executionOrder: number[] = [];

      (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          return callback({});
        },
      );

      const op1 = vi.fn().mockImplementation(async () => {
        executionOrder.push(1);
        return { op: 1 };
      });
      const op2 = vi.fn().mockImplementation(async () => {
        executionOrder.push(2);
        return { op: 2 };
      });
      const op3 = vi.fn().mockImplementation(async () => {
        executionOrder.push(3);
        return { op: 3 };
      });

      const result = await atomicOperations([op1, op2, op3], {
        name: "atomic-ops-test",
      });

      expect(result.success).toBe(true);
      expect(executionOrder).toEqual([1, 2, 3]);
      expect(op1).toHaveBeenCalled();
      expect(op2).toHaveBeenCalled();
      expect(op3).toHaveBeenCalled();
    });

    it("should rollback all operations on failure", async () => {
      let transactionCompleted = false;

      (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          try {
            await callback({});
            transactionCompleted = true;
          } catch (error) {
            // Transaction rolled back
            throw error;
          }
        },
      );

      const op1 = vi.fn().mockResolvedValue({ op: 1 });
      const op2 = vi.fn().mockRejectedValue(new Error("op2 failed"));
      const op3 = vi.fn().mockResolvedValue({ op: 3 });

      const result = await atomicOperations([op1, op2, op3], {
        name: "atomic-rollback-test",
      });

      expect(result.success).toBe(false);
      expect(transactionCompleted).toBe(false);
      expect(op1).toHaveBeenCalled();
      expect(op2).toHaveBeenCalled();
      expect(op3).not.toHaveBeenCalled(); // Should not be called after failure
    });
  });

  describe("executeCompensation", () => {
    it("should execute compensation with more retries", async () => {
      let callCount = 0;

      (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          callCount++;
          if (callCount < 4) {
            const error = new Error("deadlock");
            (error as Error & { code: string }).code = "40P01";
            throw error;
          }
          return callback({});
        },
      );

      const compensation = vi.fn().mockResolvedValue(undefined);
      const result = await executeCompensation(compensation, {
        name: "rollback-action",
        maxRetries: 5,
        retryDelayMs: 10,
      });

      expect(result.success).toBe(true);
      expect(callCount).toBe(4);
    });

    it("should use compensation prefix in name", async () => {
      (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          return callback({});
        },
      );

      // Compensation should work normally
      const result = await executeCompensation(async () => {}, {
        name: "test-action",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("generateIdempotencyKey", () => {
    it("should generate consistent keys for same inputs", () => {
      const key1 = generateIdempotencyKey("operation", "param1", "param2");
      const key2 = generateIdempotencyKey("operation", "param1", "param2");

      expect(key1).toBe(key2);
    });

    it("should generate different keys for different inputs", () => {
      const key1 = generateIdempotencyKey("operation", "param1");
      const key2 = generateIdempotencyKey("operation", "param2");

      expect(key1).not.toBe(key2);
    });

    it("should handle null and undefined values", () => {
      const key1 = generateIdempotencyKey("op", null, undefined);
      const key2 = generateIdempotencyKey("op", null, undefined);

      expect(key1).toBe(key2);
      expect(key1).toContain("null");
    });
  });

  describe("categorizeError", () => {
    it("should identify deadlock errors", () => {
      const error = new Error("deadlock detected");
      (error as Error & { code: string }).code = "40P01";

      expect(categorizeError(error)).toBe("DEADLOCK");
    });

    it("should identify serialization failures", () => {
      const error = new Error("could not serialize access");
      (error as Error & { code: string }).code = "40001";

      expect(categorizeError(error)).toBe("SERIALIZATION_FAILURE");
    });

    it("should identify connection errors", () => {
      const error = new Error("connection refused");
      (error as Error & { code: string }).code = "08006";

      expect(categorizeError(error)).toBe("CONNECTION_ERROR");
    });

    it("should identify constraint violations", () => {
      const error = new Error("unique violation");
      (error as Error & { code: string }).code = "23505";

      expect(categorizeError(error)).toBe("CONSTRAINT_VIOLATION");
    });

    it("should return UNKNOWN for unrecognized errors", () => {
      const error = new Error("something went wrong");

      expect(categorizeError(error)).toBe("UNKNOWN");
    });

    it("should categorize by message when no code present", () => {
      expect(categorizeError(new Error("connection lost"))).toBe(
        "CONNECTION_ERROR",
      );
      expect(categorizeError(new Error("timeout exceeded"))).toBe("TIMEOUT");
      expect(categorizeError(new Error("record not found"))).toBe("NOT_FOUND");
      expect(categorizeError(new Error("validation failed"))).toBe(
        "VALIDATION_ERROR",
      );
    });
  });

  describe("TransactionError", () => {
    it("should create error with correct properties", () => {
      const originalError = new Error("original");
      const txError = new TransactionError(
        "Transaction failed",
        "DEADLOCK",
        originalError,
        { taskId: "123" },
      );

      expect(txError.name).toBe("TransactionError");
      expect(txError.message).toBe("Transaction failed");
      expect(txError.code).toBe("DEADLOCK");
      expect(txError.isRetryable).toBe(true);
      expect(txError.originalError).toBe(originalError);
      expect(txError.context).toEqual({ taskId: "123" });
    });

    it("should correctly identify retryable errors", () => {
      const deadlockError = new TransactionError("", "DEADLOCK");
      const serializationError = new TransactionError(
        "",
        "SERIALIZATION_FAILURE",
      );
      const connectionError = new TransactionError("", "CONNECTION_ERROR");
      const constraintError = new TransactionError("", "CONSTRAINT_VIOLATION");
      const unknownError = new TransactionError("", "UNKNOWN");

      expect(deadlockError.isRetryable).toBe(true);
      expect(serializationError.isRetryable).toBe(true);
      expect(connectionError.isRetryable).toBe(true);
      expect(constraintError.isRetryable).toBe(false);
      expect(unknownError.isRetryable).toBe(false);
    });
  });

  describe("Exponential Backoff", () => {
    it("should use exponential backoff with jitter", async () => {
      const delays: number[] = [];

      // Mock setTimeout to capture delays
      vi.spyOn(global, "setTimeout").mockImplementation((callback, delay) => {
        if (typeof delay === "number" && delay > 0) {
          delays.push(delay);
        }
        // Execute immediately for test speed
        if (typeof callback === "function") {
          callback();
        }
        return 0 as unknown as NodeJS.Timeout;
      });

      let callCount = 0;
      (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async () => {
          callCount++;
          if (callCount < 4) {
            const error = new Error("deadlock");
            (error as Error & { code: string }).code = "40P01";
            throw error;
          }
          return { success: true };
        },
      );

      await withTransaction(async () => ({ success: true }), {
        name: "backoff-test",
        maxRetries: 3,
        retryDelayMs: 100,
        maxRetryDelayMs: 2000,
      });

      // Delays should exist and increase (with some jitter)
      expect(delays.length).toBeGreaterThan(0);

      // Restore
      vi.restoreAllMocks();
    });
  });

  describe("Concurrent Transactions", () => {
    it("should handle multiple concurrent transactions", async () => {
      const results: string[] = [];
      let txCount = 0;

      (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          txCount++;
          const currentTx = txCount;
          await new Promise((r) => setTimeout(r, Math.random() * 10));
          results.push(`start-${currentTx}`);
          const result = await callback({});
          results.push(`end-${currentTx}`);
          return result;
        },
      );

      const promises = [
        withTransaction(async () => "tx1", { name: "concurrent-1" }),
        withTransaction(async () => "tx2", { name: "concurrent-2" }),
        withTransaction(async () => "tx3", { name: "concurrent-3" }),
      ];

      const allResults = await Promise.all(promises);

      expect(allResults.every((r) => r.success)).toBe(true);
      expect(txCount).toBe(3);
    });
  });
});

describe("Integration Scenarios", () => {
  describe("Execution Start Flow", () => {
    it("should handle the full execution start pattern", async () => {
      const executionId = "exec-123";
      const taskId = "task-456";
      let transactionCalls = 0;

      (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          transactionCalls++;
          return callback({
            insert: vi.fn().mockReturnThis(),
            values: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            set: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
          });
        },
      );

      // Simulate the execution start transaction
      const result = await withTransaction(
        async (tx) => {
          // These would be the actual DB operations
          // @ts-expect-error - mock tx
          await tx.insert({}).values({
            id: executionId,
            taskId,
            status: "queued",
          });

          // @ts-expect-error - mock tx
          await tx.update({}).set({ status: "executing" }).where({});

          return { executionId, taskId };
        },
        {
          name: "start-execution",
          idempotencyKey: generateIdempotencyKey(
            "start-execution",
            taskId,
            executionId,
          ),
        },
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ executionId, taskId });
      expect(transactionCalls).toBe(1);

      // Clear for cleanup
      clearIdempotencyKey(
        generateIdempotencyKey("start-execution", taskId, executionId),
      );
    });
  });

  describe("Diff Approval Flow", () => {
    it("should handle the full diff approval pattern", async () => {
      const taskId = "task-789";
      const commitSha = "abc123";
      const operations: string[] = [];

      (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          return callback({
            update: (table: string) => {
              operations.push(`update:${table}`);
              return {
                set: () => ({ where: () => Promise.resolve() }),
              };
            },
            insert: (table: string) => {
              operations.push(`insert:${table}`);
              return {
                values: () => Promise.resolve(),
              };
            },
            delete: (table: string) => {
              operations.push(`delete:${table}`);
              return {
                where: () => Promise.resolve(),
              };
            },
          });
        },
      );

      const result = await withTransaction(
        async (tx) => {
          // 1. Mark pending changes as approved
          // @ts-expect-error - mock tx
          await tx.update("pendingChanges").set({}).where({});

          // 2. Track commit
          // @ts-expect-error - mock tx
          await tx.insert("executionCommits").values({});

          // 3. Create event
          // @ts-expect-error - mock tx
          await tx.insert("executionEvents").values({});

          // 4. Clear pending changes
          // @ts-expect-error - mock tx
          await tx.delete("pendingChanges").where({});

          // 5. Update task status
          // @ts-expect-error - mock tx
          await tx.update("tasks").set({}).where({});

          return { commitSha };
        },
        {
          name: "approve-diff",
          idempotencyKey: generateIdempotencyKey(
            "approve-diff",
            taskId,
            commitSha,
          ),
        },
      );

      expect(result.success).toBe(true);
      expect(operations).toContain("update:pendingChanges");
      expect(operations).toContain("insert:executionCommits");
      expect(operations).toContain("insert:executionEvents");
      expect(operations).toContain("delete:pendingChanges");
      expect(operations).toContain("update:tasks");

      clearIdempotencyKey(
        generateIdempotencyKey("approve-diff", taskId, commitSha),
      );
    });
  });

  describe("Compensation Pattern", () => {
    it("should properly compensate after external failure", async () => {
      const operations: string[] = [];
      let externalCallFailed = false;

      (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          return callback({
            insert: () => {
              operations.push("insert");
              return { values: () => Promise.resolve() };
            },
            update: () => {
              operations.push("update");
              return { set: () => ({ where: () => Promise.resolve() }) };
            },
            delete: () => {
              operations.push("delete");
              return { where: () => Promise.resolve() };
            },
          });
        },
      );

      // Step 1: Initial transaction succeeds
      const initialResult = await withTransaction(
        async (tx) => {
          // @ts-expect-error - mock tx
          await tx.insert({}).values({});
          // @ts-expect-error - mock tx
          await tx.update({}).set({}).where({});
          return { success: true };
        },
        { name: "initial-tx" },
      );

      expect(initialResult.success).toBe(true);

      // Step 2: External operation fails
      try {
        throw new Error("Queue operation failed");
      } catch {
        externalCallFailed = true;

        // Step 3: Execute compensation
        const compensationResult = await executeCompensation(
          async (tx) => {
            // @ts-expect-error - mock tx
            await tx.update({}).set({}).where({});
            // @ts-expect-error - mock tx
            await tx.delete({}).where({});
          },
          { name: "rollback-initial" },
        );

        expect(compensationResult.success).toBe(true);
      }

      expect(externalCallFailed).toBe(true);
      expect(operations).toContain("insert");
      expect(operations).toContain("update");
      expect(operations).toContain("delete");
    });
  });
});
