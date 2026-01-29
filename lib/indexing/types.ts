/**
 * Shared types for the indexing module
 */

import type {
  RepoIndexTechStack,
  RepoIndexEntryPoint,
  RepoIndexDependency,
  RepoIndexFileEntry,
} from "@/lib/db/schema";

export interface IndexingResult {
  fileCount: number;
  symbolCount: number;
  techStack: RepoIndexTechStack;
  entryPoints: RepoIndexEntryPoint[];
  dependencies: RepoIndexDependency[];
  fileIndex: RepoIndexFileEntry[];
}

export interface IndexingProgress {
  phase: "scanning" | "analyzing" | "complete";
  filesScanned: number;
  currentPath?: string;
}
