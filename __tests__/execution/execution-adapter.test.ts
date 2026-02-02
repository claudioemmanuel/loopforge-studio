/**
 * Execution Adapter Tests
 *
 * Verifies mapping between Execution domain models and API formats.
 */

import { describe, it, expect } from "vitest";
import {
  ExecutionAdapter,
  type ExecutionApiResponse,
  type ExecutionDetailedApiResponse,
  type StartExecutionRequest,
} from "@/lib/contexts/execution/api/adapters";
import type { ExecutionState } from "@/lib/contexts/execution/domain/execution-aggregate";

describe("ExecutionAdapter", () => {
  describe("toApiResponse", () => {
    it("should map all fields correctly with full data", () => {
      const now = new Date();
      const state: ExecutionState = {
        id: "exec-1",
        taskId: "task-1",
        status: "completed",
        branchName: "loopforge/task-1",
        configuration: {
          maxIterations: 50,
          iterationTimeout: 600000,
          enableStuckDetection: true,
          enableRecovery: true,
          enableCompletionValidation: true,
          enableSkills: true,
        },
        currentIteration: 10,
        iterations: [
          {
            number: 1,
            startedAt: now,
            completedAt: now,
            thoughts: ["Analyzing task"],
            actions: ["Read file"],
            filesExtracted: 1,
          },
        ],
        commits: [
          {
            hash: "abc123",
            message: "Fix bug",
            filesChanged: 2,
            linesAdded: 10,
            linesDeleted: 5,
            timestamp: now,
          },
        ],
        stuckSignals: [
          {
            type: "consecutive_errors",
            severity: "high",
            details: { count: 3 },
            detectedAt: now,
          },
        ],
        recoveryAttempts: [
          {
            tier: 1,
            strategy: "format_guidance",
            startedAt: now,
            completedAt: now,
            succeeded: true,
          },
        ],
        validationReport: {
          score: 85,
          passed: true,
          checks: {
            hasMarker: { passed: true, score: 100, weight: 20 },
            hasCommits: { passed: true, score: 100, weight: 20 },
            matchesPlan: { passed: true, score: 80, weight: 30 },
            qualityThreshold: { passed: true, score: 90, weight: 15 },
            testsExecuted: { passed: false, score: 0, weight: 5 },
            noCriticalErrors: { passed: true, score: 100, weight: 10 },
          },
          generatedAt: now,
        },
        startedAt: now,
        completedAt: now,
        error: null,
      };

      const response = ExecutionAdapter.toApiResponse(state);

      // Identity
      expect(response.id).toBe("exec-1");
      expect(response.taskId).toBe("task-1");

      // Status
      expect(response.status).toBe("completed");
      expect(response.iteration).toBe(10);
      expect(response.startedAt).toBe(now);
      expect(response.completedAt).toBe(now);
      expect(response.errorMessage).toBeNull();

      // Branch
      expect(response.branch).toBe("loopforge/task-1");

      // Commits (simplified - just SHAs)
      expect(response.commits).toEqual(["abc123"]);

      // Rollback (not implemented yet)
      expect(response.reverted).toBe(false);
      expect(response.revertCommitSha).toBeNull();

      // Reliability tracking
      expect(response.stuckSignals).toHaveLength(1);
      expect(response.stuckSignals?.[0].type).toBe("consecutive_errors");
      expect(response.stuckSignals?.[0].severity).toBe("high");

      expect(response.recoveryAttempts).toHaveLength(1);
      expect(response.recoveryAttempts?.[0].tier).toBe(1);
      expect(response.recoveryAttempts?.[0].succeeded).toBe(true);

      expect(response.validationReport).toBeDefined();
      expect(response.validationReport?.score).toBe(85);
      expect(response.validationReport?.passed).toBe(true);

      // Timestamps
      expect(response.createdAt).toBe(now);
    });

    it("should handle queued execution with no data", () => {
      const now = new Date();
      const state: ExecutionState = {
        id: "exec-2",
        taskId: "task-2",
        status: "queued",
        branchName: "loopforge/task-2",
        configuration: {
          maxIterations: 50,
          iterationTimeout: 600000,
          enableStuckDetection: true,
          enableRecovery: true,
          enableCompletionValidation: true,
          enableSkills: true,
        },
        currentIteration: 0,
        iterations: [],
        commits: [],
        stuckSignals: [],
        recoveryAttempts: [],
        validationReport: null,
        startedAt: now,
        completedAt: null,
        error: null,
      };

      const response = ExecutionAdapter.toApiResponse(state);

      expect(response.status).toBe("queued");
      expect(response.iteration).toBe(0);
      expect(response.completedAt).toBeNull();
      expect(response.commits).toEqual([]);
      expect(response.stuckSignals).toBeNull(); // Empty array becomes null
      expect(response.recoveryAttempts).toBeNull();
      expect(response.validationReport).toBeNull();
    });

    it("should handle failed execution with error", () => {
      const now = new Date();
      const state: ExecutionState = {
        id: "exec-3",
        taskId: "task-3",
        status: "failed",
        branchName: "loopforge/task-3",
        configuration: {
          maxIterations: 50,
          iterationTimeout: 600000,
          enableStuckDetection: true,
          enableRecovery: true,
          enableCompletionValidation: true,
          enableSkills: true,
        },
        currentIteration: 5,
        iterations: [],
        commits: [],
        stuckSignals: [],
        recoveryAttempts: [],
        validationReport: null,
        startedAt: now,
        completedAt: now,
        error: "Authentication failed",
      };

      const response = ExecutionAdapter.toApiResponse(state);

      expect(response.status).toBe("failed");
      expect(response.errorMessage).toBe("Authentication failed");
      expect(response.completedAt).toBe(now);
    });

    it("should handle multiple commits", () => {
      const now = new Date();
      const state: ExecutionState = {
        id: "exec-4",
        taskId: "task-4",
        status: "completed",
        branchName: "loopforge/task-4",
        configuration: {
          maxIterations: 50,
          iterationTimeout: 600000,
          enableStuckDetection: true,
          enableRecovery: true,
          enableCompletionValidation: true,
          enableSkills: true,
        },
        currentIteration: 15,
        iterations: [],
        commits: [
          {
            hash: "abc123",
            message: "Initial fix",
            filesChanged: 1,
            linesAdded: 10,
            linesDeleted: 0,
            timestamp: now,
          },
          {
            hash: "def456",
            message: "Add tests",
            filesChanged: 1,
            linesAdded: 20,
            linesDeleted: 0,
            timestamp: now,
          },
          {
            hash: "ghi789",
            message: "Update docs",
            filesChanged: 1,
            linesAdded: 5,
            linesDeleted: 2,
            timestamp: now,
          },
        ],
        stuckSignals: [],
        recoveryAttempts: [],
        validationReport: null,
        startedAt: now,
        completedAt: now,
        error: null,
      };

      const response = ExecutionAdapter.toApiResponse(state);

      expect(response.commits).toEqual(["abc123", "def456", "ghi789"]);
    });

    it("should handle multiple stuck signals", () => {
      const now = new Date();
      const state: ExecutionState = {
        id: "exec-5",
        taskId: "task-5",
        status: "running",
        branchName: "loopforge/task-5",
        configuration: {
          maxIterations: 50,
          iterationTimeout: 600000,
          enableStuckDetection: true,
          enableRecovery: true,
          enableCompletionValidation: true,
          enableSkills: true,
        },
        currentIteration: 20,
        iterations: [],
        commits: [],
        stuckSignals: [
          {
            type: "consecutive_errors",
            severity: "medium",
            details: { count: 2 },
            detectedAt: now,
          },
          {
            type: "repeated_patterns",
            severity: "high",
            details: { similarity: 0.85 },
            detectedAt: now,
          },
          {
            type: "no_progress",
            severity: "critical",
            details: { iterations: 5 },
            detectedAt: now,
          },
        ],
        recoveryAttempts: [],
        validationReport: null,
        startedAt: now,
        completedAt: null,
        error: null,
      };

      const response = ExecutionAdapter.toApiResponse(state);

      expect(response.stuckSignals).toHaveLength(3);
      expect(response.stuckSignals?.[0].type).toBe("consecutive_errors");
      expect(response.stuckSignals?.[1].type).toBe("repeated_patterns");
      expect(response.stuckSignals?.[2].type).toBe("no_progress");
      expect(response.stuckSignals?.[2].severity).toBe("critical");
    });

    it("should handle multiple recovery attempts", () => {
      const now = new Date();
      const state: ExecutionState = {
        id: "exec-6",
        taskId: "task-6",
        status: "running",
        branchName: "loopforge/task-6",
        configuration: {
          maxIterations: 50,
          iterationTimeout: 600000,
          enableStuckDetection: true,
          enableRecovery: true,
          enableCompletionValidation: true,
          enableSkills: true,
        },
        currentIteration: 25,
        iterations: [],
        commits: [],
        stuckSignals: [],
        recoveryAttempts: [
          {
            tier: 1,
            strategy: "format_guidance",
            startedAt: now,
            completedAt: now,
            succeeded: false,
            error: "Still failing",
          },
          {
            tier: 2,
            strategy: "simplified_prompts",
            startedAt: now,
            completedAt: now,
            succeeded: true,
          },
        ],
        validationReport: null,
        startedAt: now,
        completedAt: null,
        error: null,
      };

      const response = ExecutionAdapter.toApiResponse(state);

      expect(response.recoveryAttempts).toHaveLength(2);
      expect(response.recoveryAttempts?.[0].tier).toBe(1);
      expect(response.recoveryAttempts?.[0].succeeded).toBe(false);
      expect(response.recoveryAttempts?.[1].tier).toBe(2);
      expect(response.recoveryAttempts?.[1].succeeded).toBe(true);
    });
  });

  describe("toDetailedApiResponse", () => {
    it("should include iterations and commit details", () => {
      const now = new Date();
      const state: ExecutionState = {
        id: "exec-7",
        taskId: "task-7",
        status: "completed",
        branchName: "loopforge/task-7",
        configuration: {
          maxIterations: 50,
          iterationTimeout: 600000,
          enableStuckDetection: true,
          enableRecovery: true,
          enableCompletionValidation: true,
          enableSkills: true,
        },
        currentIteration: 3,
        iterations: [
          {
            number: 1,
            startedAt: now,
            completedAt: now,
            thoughts: ["Read files"],
            actions: ["ls", "cat file.ts"],
            filesExtracted: 2,
          },
          {
            number: 2,
            startedAt: now,
            completedAt: now,
            thoughts: ["Write code"],
            actions: ["edit file.ts"],
            filesExtracted: 1,
          },
        ],
        commits: [
          {
            hash: "abc123",
            message: "Implement feature",
            filesChanged: 1,
            linesAdded: 50,
            linesDeleted: 10,
            timestamp: now,
          },
        ],
        stuckSignals: [],
        recoveryAttempts: [],
        validationReport: null,
        startedAt: now,
        completedAt: now,
        error: null,
      };

      const response = ExecutionAdapter.toDetailedApiResponse(state);

      // Should have basic fields
      expect(response.id).toBe("exec-7");
      expect(response.commits).toEqual(["abc123"]);

      // Should have detailed fields
      expect(response.iterations).toHaveLength(2);
      expect(response.iterations[0].number).toBe(1);
      expect(response.iterations[0].thoughts).toEqual(["Read files"]);
      expect(response.iterations[1].number).toBe(2);

      expect(response.commitDetails).toHaveLength(1);
      expect(response.commitDetails[0].hash).toBe("abc123");
      expect(response.commitDetails[0].message).toBe("Implement feature");
      expect(response.commitDetails[0].filesChanged).toBe(1);
      expect(response.commitDetails[0].linesAdded).toBe(50);

      expect(response.configuration).toBeDefined();
      expect(response.configuration.maxIterations).toBe(50);
    });
  });

  describe("fromStartRequest", () => {
    it("should extract all configuration fields", () => {
      const request: StartExecutionRequest = {
        taskId: "task-1",
        branchName: "loopforge/task-1",
        maxIterations: 100,
        enableStuckDetection: false,
        enableRecovery: false,
        enableCompletionValidation: true,
        enableSkills: false,
      };

      const config = ExecutionAdapter.fromStartRequest(request);

      expect(config.maxIterations).toBe(100);
      expect(config.enableStuckDetection).toBe(false);
      expect(config.enableRecovery).toBe(false);
      expect(config.enableCompletionValidation).toBe(true);
      expect(config.enableSkills).toBe(false);
    });

    it("should extract partial configuration", () => {
      const request: StartExecutionRequest = {
        taskId: "task-2",
        branchName: "loopforge/task-2",
        maxIterations: 25,
      };

      const config = ExecutionAdapter.fromStartRequest(request);

      expect(config.maxIterations).toBe(25);
      expect(config.enableStuckDetection).toBeUndefined();
      expect(config.enableRecovery).toBeUndefined();
    });

    it("should handle minimal request", () => {
      const request: StartExecutionRequest = {
        taskId: "task-3",
        branchName: "loopforge/task-3",
      };

      const config = ExecutionAdapter.fromStartRequest(request);

      expect(config).toEqual({});
    });

    it("should handle boolean false values correctly", () => {
      const request: StartExecutionRequest = {
        taskId: "task-4",
        branchName: "loopforge/task-4",
        enableStuckDetection: false,
        enableRecovery: false,
        enableCompletionValidation: false,
        enableSkills: false,
      };

      const config = ExecutionAdapter.fromStartRequest(request);

      expect(config.enableStuckDetection).toBe(false);
      expect(config.enableRecovery).toBe(false);
      expect(config.enableCompletionValidation).toBe(false);
      expect(config.enableSkills).toBe(false);
    });
  });

  describe("fromDatabaseRow", () => {
    it("should map all fields from database row", () => {
      const now = new Date();
      const row = {
        id: "exec-1",
        taskId: "task-1",
        status: "completed" as const,
        iteration: 10,
        startedAt: now,
        completedAt: now,
        errorMessage: null,
        branch: "loopforge/task-1",
        commits: ["abc123", "def456"],
        stuckSignals: [
          {
            type: "consecutive_errors",
            severity: "high",
            details: { count: 3 },
            detectedAt: now.toISOString(),
          },
        ],
        recoveryAttempts: [
          {
            tier: 1,
            strategy: "format_guidance",
            startedAt: now.toISOString(),
            completedAt: now.toISOString(),
            succeeded: true,
          },
        ],
        validationReport: {
          score: 85,
          passed: true,
          checks: {},
          generatedAt: now.toISOString(),
        },
        createdAt: now,
      };

      const state = ExecutionAdapter.fromDatabaseRow(row);

      expect(state.id).toBe("exec-1");
      expect(state.taskId).toBe("task-1");
      expect(state.status).toBe("completed");
      expect(state.branchName).toBe("loopforge/task-1");
      expect(state.currentIteration).toBe(10);
      expect(state.startedAt).toBe(now);
      expect(state.completedAt).toBe(now);
      expect(state.error).toBeNull();

      expect(state.commits).toHaveLength(2);
      expect(state.commits[0].hash).toBe("abc123");
      expect(state.commits[1].hash).toBe("def456");

      expect(state.stuckSignals).toHaveLength(1);
      expect(state.stuckSignals[0].type).toBe("consecutive_errors");

      expect(state.recoveryAttempts).toHaveLength(1);
      expect(state.recoveryAttempts[0].tier).toBe(1);

      expect(state.validationReport).toBeDefined();
      expect(state.validationReport?.score).toBe(85);

      expect(state.configuration.maxIterations).toBe(50); // Default
    });

    it("should handle minimal database row", () => {
      const now = new Date();
      const row = {
        id: "exec-2",
        taskId: "task-2",
        status: "queued" as const,
        iteration: 0,
        createdAt: now,
      };

      const state = ExecutionAdapter.fromDatabaseRow(row);

      expect(state.id).toBe("exec-2");
      expect(state.status).toBe("queued");
      expect(state.currentIteration).toBe(0);
      expect(state.branchName).toBe(""); // Empty when null
      expect(state.commits).toEqual([]);
      expect(state.stuckSignals).toEqual([]);
      expect(state.recoveryAttempts).toEqual([]);
      expect(state.validationReport).toBeNull();
      expect(state.startedAt).toBe(now); // Falls back to createdAt
      expect(state.completedAt).toBeNull();
    });

    it("should handle null JSONB fields", () => {
      const now = new Date();
      const row = {
        id: "exec-3",
        taskId: "task-3",
        status: "running" as const,
        iteration: 5,
        startedAt: now,
        stuckSignals: null,
        recoveryAttempts: null,
        validationReport: null,
        createdAt: now,
      };

      const state = ExecutionAdapter.fromDatabaseRow(row);

      expect(state.stuckSignals).toEqual([]);
      expect(state.recoveryAttempts).toEqual([]);
      expect(state.validationReport).toBeNull();
    });

    it("should handle invalid JSONB fields", () => {
      const now = new Date();
      const row = {
        id: "exec-4",
        taskId: "task-4",
        status: "running" as const,
        iteration: 5,
        startedAt: now,
        stuckSignals: "invalid",
        recoveryAttempts: 123,
        validationReport: "not an object",
        createdAt: now,
      };

      const state = ExecutionAdapter.fromDatabaseRow(row);

      // Should handle gracefully
      expect(state.stuckSignals).toEqual([]);
      expect(state.recoveryAttempts).toEqual([]);
      expect(state.validationReport).toBeNull();
    });
  });

  describe("Round-trip conversion", () => {
    it("should preserve data through database -> domain -> API conversion", () => {
      const now = new Date();
      const dbRow = {
        id: "exec-1",
        taskId: "task-1",
        status: "completed" as const,
        iteration: 10,
        startedAt: now,
        completedAt: now,
        errorMessage: null,
        branch: "loopforge/task-1",
        commits: ["abc123"],
        stuckSignals: [],
        recoveryAttempts: [],
        validationReport: null,
        createdAt: now,
      };

      // DB -> Domain
      const state = ExecutionAdapter.fromDatabaseRow(dbRow);

      // Domain -> API
      const apiResponse = ExecutionAdapter.toApiResponse(state);

      // Verify key fields preserved
      expect(apiResponse.id).toBe(dbRow.id);
      expect(apiResponse.taskId).toBe(dbRow.taskId);
      expect(apiResponse.status).toBe(dbRow.status);
      expect(apiResponse.iteration).toBe(dbRow.iteration);
      expect(apiResponse.branch).toBe(dbRow.branch);
      expect(apiResponse.commits).toEqual(dbRow.commits);
      expect(apiResponse.startedAt).toBe(dbRow.startedAt);
      expect(apiResponse.completedAt).toBe(dbRow.completedAt);
    });
  });
});
