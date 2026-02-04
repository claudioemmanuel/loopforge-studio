/**
 * Repository Adapter Tests
 *
 * Verifies mapping between Repository domain models and API formats.
 */

import { describe, it, expect } from "vitest";
import {
  RepositoryAdapter,
  type RepositoryApiResponse,
  type ConnectRepositoryRequest,
  type UpdateRepositoryRequest,
} from "@/lib/contexts/repository/api/adapters";
import type { RepositoryState } from "@/lib/contexts/repository/domain/repository-aggregate";

describe("RepositoryAdapter", () => {
  describe("toApiResponse", () => {
    it("should map all fields correctly with full data", () => {
      const now = new Date();
      const state: RepositoryState = {
        id: "repo-1",
        userId: "user-1",
        metadata: {
          githubRepoId: "gh-123",
          name: "test-repo",
          fullName: "owner/test-repo",
          defaultBranch: "main",
          cloneUrl: "https://github.com/owner/test-repo.git",
          isPrivate: false,
        },
        cloneInfo: {
          status: "cloned",
          path: "/tmp/repos/test-repo",
          startedAt: now,
          completedAt: now,
          error: null,
        },
        indexingStatus: "indexed",
        indexedAt: now,
        testConfig: {
          command: "npm test",
          timeout: 300000,
          enabled: true,
          gatePolicy: "warn",
          criticalPatterns: ["auth", "payment"],
        },
        prConfig: {
          titleTemplate: "[LoopForge] {{title}}",
          targetBranch: "main",
          draftDefault: false,
          reviewers: ["reviewer1"],
          labels: ["auto"],
          autoApprove: false,
        },
        createdAt: now,
        updatedAt: now,
      };

      const response = RepositoryAdapter.toApiResponse(state);

      // Identity
      expect(response.id).toBe("repo-1");
      expect(response.userId).toBe("user-1");

      // Repository metadata
      expect(response.githubRepoId).toBe("gh-123");
      expect(response.name).toBe("test-repo");
      expect(response.fullName).toBe("owner/test-repo");
      expect(response.defaultBranch).toBe("main");
      expect(response.cloneUrl).toBe("https://github.com/owner/test-repo.git");
      expect(response.isPrivate).toBe(false);

      // Clone information (including legacy fields)
      expect(response.localPath).toBe("/tmp/repos/test-repo");
      expect(response.isCloned).toBe(true);
      expect(response.clonedAt).toBe(now);
      expect(response.cloneStatus).toBe("cloned");
      expect(response.clonePath).toBe("/tmp/repos/test-repo");
      expect(response.cloneStartedAt).toBe(now);
      expect(response.cloneCompletedAt).toBe(now);
      expect(response.cloneError).toBeNull();

      // Indexing
      expect(response.indexingStatus).toBe("indexed");
      expect(response.indexedAt).toBe(now);

      // Test configuration
      expect(response.testCommand).toBe("npm test");
      expect(response.testTimeout).toBe(300000);
      expect(response.testsEnabled).toBe(true);
      expect(response.testGatePolicy).toBe("warn");
      expect(response.criticalTestPatterns).toEqual(["auth", "payment"]);

      // PR configuration
      expect(response.prTitleTemplate).toBe("[LoopForge] {{title}}");
      expect(response.prTargetBranch).toBe("main");
      expect(response.prDraftDefault).toBe(false);
      expect(response.prReviewers).toEqual(["reviewer1"]);
      expect(response.prLabels).toEqual(["auto"]);
      expect(response.autoApprove).toBe(false);

      // Timestamps
      expect(response.createdAt).toBe(now);
      expect(response.updatedAt).toBe(now);
    });

    it("should handle not_cloned status", () => {
      const state: RepositoryState = {
        id: "repo-2",
        userId: "user-1",
        metadata: {
          githubRepoId: "gh-456",
          name: "uncloned-repo",
          fullName: "owner/uncloned-repo",
          defaultBranch: "main",
          cloneUrl: "https://github.com/owner/uncloned-repo.git",
          isPrivate: false,
        },
        cloneInfo: {
          status: "not_cloned",
          path: null,
          startedAt: null,
          completedAt: null,
          error: null,
        },
        indexingStatus: "pending",
        indexedAt: null,
        testConfig: {
          command: null,
          timeout: 300000,
          enabled: true,
          gatePolicy: "warn",
          criticalPatterns: [],
        },
        prConfig: {
          titleTemplate: "[LoopForge] {{title}}",
          targetBranch: null,
          draftDefault: false,
          reviewers: [],
          labels: [],
          autoApprove: false,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const response = RepositoryAdapter.toApiResponse(state);

      expect(response.cloneStatus).toBe("not_cloned");
      expect(response.isCloned).toBe(false); // Legacy boolean
      expect(response.clonePath).toBeNull();
      expect(response.localPath).toBeNull();
      expect(response.cloneStartedAt).toBeNull();
      expect(response.cloneCompletedAt).toBeNull();
      expect(response.clonedAt).toBeNull();
      expect(response.indexingStatus).toBe("pending");
      expect(response.indexedAt).toBeNull();
    });

    it("should handle cloning status", () => {
      const now = new Date();
      const state: RepositoryState = {
        id: "repo-3",
        userId: "user-1",
        metadata: {
          githubRepoId: "gh-789",
          name: "cloning-repo",
          fullName: "owner/cloning-repo",
          defaultBranch: "main",
          cloneUrl: "https://github.com/owner/cloning-repo.git",
          isPrivate: false,
        },
        cloneInfo: {
          status: "cloning",
          path: "/tmp/repos/cloning-repo",
          startedAt: now,
          completedAt: null,
          error: null,
        },
        indexingStatus: "pending",
        indexedAt: null,
        testConfig: {
          command: null,
          timeout: 300000,
          enabled: true,
          gatePolicy: "warn",
          criticalPatterns: [],
        },
        prConfig: {
          titleTemplate: "[LoopForge] {{title}}",
          targetBranch: null,
          draftDefault: false,
          reviewers: [],
          labels: [],
          autoApprove: false,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const response = RepositoryAdapter.toApiResponse(state);

      expect(response.cloneStatus).toBe("cloning");
      expect(response.isCloned).toBe(false); // Not yet cloned
      expect(response.cloneStartedAt).toBe(now);
      expect(response.cloneCompletedAt).toBeNull();
    });

    it("should handle failed clone", () => {
      const now = new Date();
      const state: RepositoryState = {
        id: "repo-4",
        userId: "user-1",
        metadata: {
          githubRepoId: "gh-101",
          name: "failed-repo",
          fullName: "owner/failed-repo",
          defaultBranch: "main",
          cloneUrl: "https://github.com/owner/failed-repo.git",
          isPrivate: true,
        },
        cloneInfo: {
          status: "failed",
          path: null,
          startedAt: now,
          completedAt: null,
          error: "Authentication failed",
        },
        indexingStatus: "pending",
        indexedAt: null,
        testConfig: {
          command: null,
          timeout: 300000,
          enabled: true,
          gatePolicy: "warn",
          criticalPatterns: [],
        },
        prConfig: {
          titleTemplate: "[LoopForge] {{title}}",
          targetBranch: null,
          draftDefault: false,
          reviewers: [],
          labels: [],
          autoApprove: false,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const response = RepositoryAdapter.toApiResponse(state);

      expect(response.cloneStatus).toBe("failed");
      expect(response.isCloned).toBe(false);
      expect(response.cloneError).toBe("Authentication failed");
    });

    it("should handle private repository", () => {
      const state: RepositoryState = {
        id: "repo-5",
        userId: "user-1",
        metadata: {
          githubRepoId: "gh-private",
          name: "private-repo",
          fullName: "owner/private-repo",
          defaultBranch: "main",
          cloneUrl: "https://github.com/owner/private-repo.git",
          isPrivate: true,
        },
        cloneInfo: {
          status: "not_cloned",
          path: null,
          startedAt: null,
          completedAt: null,
          error: null,
        },
        indexingStatus: "pending",
        indexedAt: null,
        testConfig: {
          command: null,
          timeout: 300000,
          enabled: true,
          gatePolicy: "warn",
          criticalPatterns: [],
        },
        prConfig: {
          titleTemplate: "[LoopForge] {{title}}",
          targetBranch: null,
          draftDefault: false,
          reviewers: [],
          labels: [],
          autoApprove: false,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const response = RepositoryAdapter.toApiResponse(state);

      expect(response.isPrivate).toBe(true);
    });

    it("should handle custom test configuration", () => {
      const state: RepositoryState = {
        id: "repo-6",
        userId: "user-1",
        metadata: {
          githubRepoId: "gh-test",
          name: "test-repo",
          fullName: "owner/test-repo",
          defaultBranch: "main",
          cloneUrl: "https://github.com/owner/test-repo.git",
          isPrivate: false,
        },
        cloneInfo: {
          status: "not_cloned",
          path: null,
          startedAt: null,
          completedAt: null,
          error: null,
        },
        indexingStatus: "pending",
        indexedAt: null,
        testConfig: {
          command: "pytest tests/",
          timeout: 600000,
          enabled: false,
          gatePolicy: "strict",
          criticalPatterns: ["security", "auth", "billing"],
        },
        prConfig: {
          titleTemplate: "[Custom] {{title}}",
          targetBranch: "develop",
          draftDefault: true,
          reviewers: ["reviewer1", "reviewer2"],
          labels: ["automated", "needs-review"],
          autoApprove: true,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const response = RepositoryAdapter.toApiResponse(state);

      expect(response.testCommand).toBe("pytest tests/");
      expect(response.testTimeout).toBe(600000);
      expect(response.testsEnabled).toBe(false);
      expect(response.testGatePolicy).toBe("strict");
      expect(response.criticalTestPatterns).toEqual([
        "security",
        "auth",
        "billing",
      ]);

      expect(response.prTitleTemplate).toBe("[Custom] {{title}}");
      expect(response.prTargetBranch).toBe("develop");
      expect(response.prDraftDefault).toBe(true);
      expect(response.prReviewers).toEqual(["reviewer1", "reviewer2"]);
      expect(response.prLabels).toEqual(["automated", "needs-review"]);
      expect(response.autoApprove).toBe(true);
    });
  });

  describe("fromConnectRequest", () => {
    it("should extract repository metadata", () => {
      const request: ConnectRepositoryRequest = {
        githubRepoId: "gh-123",
        name: "my-repo",
        fullName: "owner/my-repo",
        defaultBranch: "main",
        cloneUrl: "https://github.com/owner/my-repo.git",
        isPrivate: false,
      };

      const metadata = RepositoryAdapter.fromConnectRequest(request);

      expect(metadata.githubRepoId).toBe("gh-123");
      expect(metadata.name).toBe("my-repo");
      expect(metadata.fullName).toBe("owner/my-repo");
      expect(metadata.defaultBranch).toBe("main");
      expect(metadata.cloneUrl).toBe("https://github.com/owner/my-repo.git");
      expect(metadata.isPrivate).toBe(false);
    });

    it("should handle private repository", () => {
      const request: ConnectRepositoryRequest = {
        githubRepoId: "gh-private",
        name: "private-repo",
        fullName: "owner/private-repo",
        defaultBranch: "main",
        cloneUrl: "https://github.com/owner/private-repo.git",
        isPrivate: true,
      };

      const metadata = RepositoryAdapter.fromConnectRequest(request);

      expect(metadata.isPrivate).toBe(true);
    });
  });

  describe("fromUpdateRequest", () => {
    it("should extract test configuration only", () => {
      const request: UpdateRepositoryRequest = {
        testCommand: "npm test",
        testTimeout: 600000,
        testsEnabled: false,
      };

      const result = RepositoryAdapter.fromUpdateRequest(request);

      expect(result.testConfig).toBeDefined();
      expect(result.testConfig?.command).toBe("npm test");
      expect(result.testConfig?.timeout).toBe(600000);
      expect(result.testConfig?.enabled).toBe(false);
      expect(result.prConfig).toBeUndefined();
    });

    it("should extract PR configuration only", () => {
      const request: UpdateRepositoryRequest = {
        prTitleTemplate: "[Custom] {{title}}",
        prTargetBranch: "develop",
        prDraftDefault: true,
      };

      const result = RepositoryAdapter.fromUpdateRequest(request);

      expect(result.testConfig).toBeUndefined();
      expect(result.prConfig).toBeDefined();
      expect(result.prConfig?.titleTemplate).toBe("[Custom] {{title}}");
      expect(result.prConfig?.targetBranch).toBe("develop");
      expect(result.prConfig?.draftDefault).toBe(true);
    });

    it("should extract both test and PR configuration", () => {
      const request: UpdateRepositoryRequest = {
        testCommand: "pytest",
        testsEnabled: true,
        prTitleTemplate: "[Test] {{title}}",
        autoApprove: true,
      };

      const result = RepositoryAdapter.fromUpdateRequest(request);

      expect(result.testConfig).toBeDefined();
      expect(result.testConfig?.command).toBe("pytest");
      expect(result.testConfig?.enabled).toBe(true);

      expect(result.prConfig).toBeDefined();
      expect(result.prConfig?.titleTemplate).toBe("[Test] {{title}}");
      expect(result.prConfig?.autoApprove).toBe(true);
    });

    it("should handle empty request", () => {
      const request: UpdateRepositoryRequest = {};

      const result = RepositoryAdapter.fromUpdateRequest(request);

      expect(result.testConfig).toBeUndefined();
      expect(result.prConfig).toBeUndefined();
    });

    it("should handle test gate policy and patterns", () => {
      const request: UpdateRepositoryRequest = {
        testGatePolicy: "strict",
        criticalTestPatterns: ["auth", "payment"],
      };

      const result = RepositoryAdapter.fromUpdateRequest(request);

      expect(result.testConfig).toBeDefined();
      expect(result.testConfig?.gatePolicy).toBe("strict");
      expect(result.testConfig?.criticalPatterns).toEqual(["auth", "payment"]);
    });

    it("should handle null values", () => {
      const request: UpdateRepositoryRequest = {
        testCommand: null,
        prTargetBranch: null,
      };

      const result = RepositoryAdapter.fromUpdateRequest(request);

      expect(result.testConfig).toBeDefined();
      expect(result.testConfig?.command).toBeNull();

      expect(result.prConfig).toBeDefined();
      expect(result.prConfig?.targetBranch).toBeNull();
    });
  });

  describe("fromDatabaseRow", () => {
    it("should map all fields from database row", () => {
      const now = new Date();
      const row = {
        id: "repo-1",
        userId: "user-1",
        githubRepoId: "gh-123",
        name: "db-repo",
        fullName: "owner/db-repo",
        defaultBranch: "main",
        cloneUrl: "https://github.com/owner/db-repo.git",
        isPrivate: false,
        localPath: "/tmp/repos/db-repo",
        isCloned: true,
        clonedAt: now,
        cloneStatus: "cloned" as const,
        clonePath: "/tmp/repos/db-repo",
        cloneStartedAt: now,
        cloneCompletedAt: now,
        cloneError: null,
        indexingStatus: "indexed" as const,
        indexedAt: now,
        testCommand: "npm test",
        testTimeout: 300000,
        testsEnabled: true,
        testGatePolicy: "warn" as const,
        criticalTestPatterns: ["auth"],
        prTitleTemplate: "[LoopForge] {{title}}",
        prTargetBranch: "main",
        prDraftDefault: false,
        prReviewers: ["reviewer1"],
        prLabels: ["auto"],
        autoApprove: false,
        createdAt: now,
        updatedAt: now,
      };

      const state = RepositoryAdapter.fromDatabaseRow(row);

      expect(state.id).toBe("repo-1");
      expect(state.userId).toBe("user-1");

      expect(state.metadata.githubRepoId).toBe("gh-123");
      expect(state.metadata.name).toBe("db-repo");
      expect(state.metadata.fullName).toBe("owner/db-repo");

      expect(state.cloneInfo.status).toBe("cloned");
      expect(state.cloneInfo.path).toBe("/tmp/repos/db-repo");
      expect(state.cloneInfo.startedAt).toBe(now);
      expect(state.cloneInfo.completedAt).toBe(now);

      expect(state.indexingStatus).toBe("indexed");
      expect(state.indexedAt).toBe(now);

      expect(state.testConfig.command).toBe("npm test");
      expect(state.testConfig.timeout).toBe(300000);
      expect(state.testConfig.enabled).toBe(true);
      expect(state.testConfig.gatePolicy).toBe("warn");
      expect(state.testConfig.criticalPatterns).toEqual(["auth"]);

      expect(state.prConfig.titleTemplate).toBe("[LoopForge] {{title}}");
      expect(state.prConfig.targetBranch).toBe("main");
      expect(state.prConfig.autoApprove).toBe(false);
    });

    it("should use defaults for missing optional fields", () => {
      const row = {
        id: "repo-2",
        userId: "user-1",
        githubRepoId: "gh-456",
        name: "minimal-repo",
        fullName: "owner/minimal-repo",
        defaultBranch: "main",
        cloneUrl: "https://github.com/owner/minimal-repo.git",
        isPrivate: false,
        indexingStatus: "pending" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const state = RepositoryAdapter.fromDatabaseRow(row);

      expect(state.cloneInfo.status).toBe("not_cloned"); // Default
      expect(state.cloneInfo.path).toBeNull();
      expect(state.indexedAt).toBeNull();

      expect(state.testConfig.command).toBeNull();
      expect(state.testConfig.timeout).toBe(300000); // Default
      expect(state.testConfig.enabled).toBe(true); // Default
      expect(state.testConfig.gatePolicy).toBe("warn"); // Default
      expect(state.testConfig.criticalPatterns).toEqual([]); // Default

      expect(state.prConfig.titleTemplate).toBe("[LoopForge] {{title}}"); // Default
      expect(state.prConfig.targetBranch).toBeNull();
      expect(state.prConfig.draftDefault).toBe(false); // Default
      expect(state.prConfig.reviewers).toEqual([]); // Default
      expect(state.prConfig.labels).toEqual([]); // Default
      expect(state.prConfig.autoApprove).toBe(false); // Default
    });

    it("should handle legacy clone fields", () => {
      const now = new Date();
      const row = {
        id: "repo-3",
        userId: "user-1",
        githubRepoId: "gh-legacy",
        name: "legacy-repo",
        fullName: "owner/legacy-repo",
        defaultBranch: "main",
        cloneUrl: "https://github.com/owner/legacy-repo.git",
        isPrivate: false,
        localPath: "/legacy/path",
        clonedAt: now,
        indexingStatus: "pending" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const state = RepositoryAdapter.fromDatabaseRow(row);

      // Should use legacy fields when new fields are missing
      expect(state.cloneInfo.path).toBe("/legacy/path");
      expect(state.cloneInfo.completedAt).toBe(now);
    });

    it("should prefer new clone fields over legacy", () => {
      const now = new Date();
      const later = new Date(now.getTime() + 1000);

      const row = {
        id: "repo-4",
        userId: "user-1",
        githubRepoId: "gh-new",
        name: "new-repo",
        fullName: "owner/new-repo",
        defaultBranch: "main",
        cloneUrl: "https://github.com/owner/new-repo.git",
        isPrivate: false,
        localPath: "/legacy/path",
        clonedAt: now,
        clonePath: "/new/path",
        cloneCompletedAt: later,
        indexingStatus: "pending" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const state = RepositoryAdapter.fromDatabaseRow(row);

      // Should prefer new fields
      expect(state.cloneInfo.path).toBe("/new/path");
      expect(state.cloneInfo.completedAt).toBe(later);
    });
  });

  describe("Round-trip conversion", () => {
    it("should preserve data through database -> domain -> API conversion", () => {
      const now = new Date();
      const dbRow = {
        id: "repo-1",
        userId: "user-1",
        githubRepoId: "gh-roundtrip",
        name: "roundtrip-repo",
        fullName: "owner/roundtrip-repo",
        defaultBranch: "main",
        cloneUrl: "https://github.com/owner/roundtrip-repo.git",
        isPrivate: true,
        cloneStatus: "cloned" as const,
        clonePath: "/tmp/repos/roundtrip-repo",
        cloneStartedAt: now,
        cloneCompletedAt: now,
        indexingStatus: "indexed" as const,
        indexedAt: now,
        testCommand: "npm test",
        testTimeout: 300000,
        testsEnabled: true,
        testGatePolicy: "strict" as const,
        criticalTestPatterns: ["auth"],
        prTitleTemplate: "[Auto] {{title}}",
        prTargetBranch: "develop",
        prDraftDefault: true,
        prReviewers: ["reviewer"],
        prLabels: ["automated"],
        autoApprove: true,
        createdAt: now,
        updatedAt: now,
      };

      // DB -> Domain
      const state = RepositoryAdapter.fromDatabaseRow(dbRow);

      // Domain -> API
      const apiResponse = RepositoryAdapter.toApiResponse(state);

      // Verify key fields preserved
      expect(apiResponse.id).toBe(dbRow.id);
      expect(apiResponse.githubRepoId).toBe(dbRow.githubRepoId);
      expect(apiResponse.name).toBe(dbRow.name);
      expect(apiResponse.isPrivate).toBe(dbRow.isPrivate);
      expect(apiResponse.cloneStatus).toBe(dbRow.cloneStatus);
      expect(apiResponse.clonePath).toBe(dbRow.clonePath);
      expect(apiResponse.indexingStatus).toBe(dbRow.indexingStatus);
      expect(apiResponse.testCommand).toBe(dbRow.testCommand);
      expect(apiResponse.testGatePolicy).toBe(dbRow.testGatePolicy);
      expect(apiResponse.prTitleTemplate).toBe(dbRow.prTitleTemplate);
      expect(apiResponse.autoApprove).toBe(dbRow.autoApprove);
    });
  });
});
