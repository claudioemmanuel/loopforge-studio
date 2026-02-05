/**
 * Repository Domain Types
 *
 * Value objects and types for the Repository Management context.
 */

import type {
  RepoIndexTechStack,
  RepoIndexEntryPoint,
  RepoIndexDependency,
  RepoIndexFileEntry,
} from "@/lib/db/schema";

/**
 * Clone status
 */
export type CloneStatus =
  | "not_cloned"
  | "cloning"
  | "cloned"
  | "failed"
  | "updating";

/**
 * Indexing status
 */
export type IndexingStatus = "pending" | "indexing" | "indexed" | "failed";

/**
 * Test gate policy
 */
export type TestGatePolicy = "strict" | "warn" | "skip" | "autoApprove";

/**
 * Clone information
 */
export interface CloneInfo {
  status: CloneStatus;
  path: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  error: string | null;
}

/**
 * Test configuration
 */
export interface TestConfiguration {
  command: string | null;
  timeout: number;
  enabled: boolean;
  gatePolicy: TestGatePolicy;
  criticalPatterns: string[];
}

/**
 * Pull request configuration
 */
export interface PRConfiguration {
  titleTemplate: string;
  targetBranch: string | null;
  draftDefault: boolean;
  reviewers: string[];
  labels: string[];
  autoApprove: boolean;
}

/**
 * Repository metadata
 */
export interface RepositoryMetadata {
  githubRepoId: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  cloneUrl: string;
  isPrivate: boolean;
}

/**
 * Repository index metadata (tech stack, symbols, etc.)
 */
export interface IndexMetadata {
  fileCount: number;
  symbolCount: number;
  techStack: TechStack;
  entryPoints: EntryPoint[];
  dependencies: Dependency[];
}

/**
 * Tech stack information
 */
export interface TechStack {
  languages: string[];
  frameworks: string[];
  packageManagers: string[];
}

/**
 * Entry point information
 */
export interface EntryPoint {
  path: string;
  type: "main" | "test" | "config";
  description?: string;
}

/**
 * Dependency information
 */
export interface Dependency {
  name: string;
  version: string;
  type: "production" | "development";
}

/**
 * Default test configuration values
 */
export const DEFAULT_TEST_CONFIG: TestConfiguration = {
  command: null,
  timeout: 300000, // 5 minutes
  enabled: true,
  gatePolicy: "warn",
  criticalPatterns: [],
};

/**
 * Result of a repository indexing pass (file scan + tech-stack detection).
 */
export interface IndexingResult {
  fileCount: number;
  symbolCount: number;
  techStack: RepoIndexTechStack;
  entryPoints: RepoIndexEntryPoint[];
  dependencies: RepoIndexDependency[];
  fileIndex: RepoIndexFileEntry[];
}

/**
 * Progress callback payload emitted while indexing.
 */
export interface IndexingProgress {
  phase: "scanning" | "analyzing" | "complete";
  filesScanned: number;
  currentPath?: string;
}

/**
 * Default PR configuration values
 */
export const DEFAULT_PR_CONFIG: PRConfiguration = {
  titleTemplate: "[LoopForge] {{title}}",
  targetBranch: null,
  draftDefault: false,
  reviewers: [],
  labels: [],
  autoApprove: false,
};
