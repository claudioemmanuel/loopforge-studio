/**
 * Repository Indexing System
 *
 * Analyzes a repository to extract:
 * - File structure and metadata
 * - Tech stack detection (languages, frameworks, build tools)
 * - Entry points and exports
 * - Dependencies
 */

import fs from "fs/promises";
import path from "path";
import type {
  RepoIndexTechStack,
  RepoIndexEntryPoint,
  RepoIndexDependency,
  RepoIndexFileEntry,
} from "@/lib/db/schema";

// Re-export types
export type { IndexingResult, IndexingProgress } from "./types";
import type { IndexingResult, IndexingProgress } from "./types";

// Re-export submodules
export {
  detectLanguages,
  detectBuildTools,
  detectFrameworks,
} from "./tech-detection";
export { walkDirectory } from "./file-scanner";

// Import for internal use
import {
  detectLanguages,
  detectBuildTools,
  detectFrameworks,
} from "./tech-detection";
import { walkDirectory } from "./file-scanner";

/**
 * Extract dependencies from package.json
 */
async function extractNpmDependencies(
  repoPath: string,
): Promise<RepoIndexDependency[]> {
  const packageJsonPath = path.join(repoPath, "package.json");
  const deps: RepoIndexDependency[] = [];

  try {
    const content = await fs.readFile(packageJsonPath, "utf-8");
    const pkg = JSON.parse(content);

    if (pkg.dependencies) {
      for (const [name, version] of Object.entries(pkg.dependencies)) {
        deps.push({
          name,
          version: String(version),
          type: "production",
        });
      }
    }

    if (pkg.devDependencies) {
      for (const [name, version] of Object.entries(pkg.devDependencies)) {
        deps.push({
          name,
          version: String(version),
          type: "development",
        });
      }
    }

    if (pkg.peerDependencies) {
      for (const [name, version] of Object.entries(pkg.peerDependencies)) {
        deps.push({
          name,
          version: String(version),
          type: "peer",
        });
      }
    }
  } catch {
    // No package.json or invalid
  }

  return deps;
}

/**
 * Find entry points in the repository
 */
async function findEntryPoints(
  repoPath: string,
  files: RepoIndexFileEntry[],
): Promise<RepoIndexEntryPoint[]> {
  const entryPoints: RepoIndexEntryPoint[] = [];

  // Check package.json for main/exports
  try {
    const packageJsonPath = path.join(repoPath, "package.json");
    const content = await fs.readFile(packageJsonPath, "utf-8");
    const pkg = JSON.parse(content);

    if (pkg.main) {
      entryPoints.push({
        path: pkg.main,
        type: "main",
        description: "Package main entry",
      });
    }

    if (pkg.exports) {
      if (typeof pkg.exports === "string") {
        entryPoints.push({
          path: pkg.exports,
          type: "export",
          description: "Package export",
        });
      } else if (typeof pkg.exports === "object") {
        for (const [key, value] of Object.entries(pkg.exports)) {
          const exportPath =
            typeof value === "string"
              ? value
              : (value as Record<string, string>)?.default ||
                (value as Record<string, string>)?.import;
          if (exportPath) {
            entryPoints.push({
              path: exportPath,
              type: "export",
              description: `Export: ${key}`,
            });
          }
        }
      }
    }
  } catch {
    // No package.json
  }

  // Common entry point patterns
  const commonEntryPoints = [
    { pattern: "src/index.ts", type: "entry" as const },
    { pattern: "src/index.tsx", type: "entry" as const },
    { pattern: "src/index.js", type: "entry" as const },
    { pattern: "src/main.ts", type: "entry" as const },
    { pattern: "src/main.tsx", type: "entry" as const },
    { pattern: "src/app.ts", type: "entry" as const },
    { pattern: "src/app.tsx", type: "entry" as const },
    { pattern: "app/page.tsx", type: "entry" as const },
    { pattern: "app/layout.tsx", type: "entry" as const },
    { pattern: "pages/index.tsx", type: "entry" as const },
    { pattern: "pages/_app.tsx", type: "entry" as const },
    { pattern: "index.ts", type: "entry" as const },
    { pattern: "index.js", type: "entry" as const },
    { pattern: "main.py", type: "entry" as const },
    { pattern: "app.py", type: "entry" as const },
    { pattern: "main.go", type: "entry" as const },
    { pattern: "cmd/main.go", type: "entry" as const },
    { pattern: "src/main.rs", type: "entry" as const },
    { pattern: "src/lib.rs", type: "entry" as const },
  ];

  const filePaths = new Set(files.map((f) => f.path));

  for (const { pattern, type } of commonEntryPoints) {
    if (filePaths.has(pattern)) {
      // Don't add duplicates
      if (!entryPoints.some((ep) => ep.path === pattern)) {
        entryPoints.push({
          path: pattern,
          type,
          description: `Entry point: ${pattern}`,
        });
      }
    }
  }

  // Config files
  const configFiles = [
    "next.config.js",
    "next.config.ts",
    "next.config.mjs",
    "vite.config.ts",
    "vite.config.js",
    "webpack.config.js",
    "tsconfig.json",
    "package.json",
    ".env.example",
    "docker-compose.yml",
    "Dockerfile",
  ];

  for (const config of configFiles) {
    if (filePaths.has(config)) {
      entryPoints.push({
        path: config,
        type: "config",
        description: `Config: ${config}`,
      });
    }
  }

  return entryPoints;
}

/**
 * Main indexing function
 */
export async function indexRepository(
  repoPath: string,
  onProgress?: (progress: IndexingProgress) => void,
): Promise<IndexingResult> {
  // Phase 1: Scan files
  onProgress?.({ phase: "scanning", filesScanned: 0 });
  const fileIndex = await walkDirectory(repoPath, repoPath, onProgress);

  // Phase 2: Analyze
  onProgress?.({ phase: "analyzing", filesScanned: fileIndex.length });

  // Extract dependencies
  const dependencies = await extractNpmDependencies(repoPath);

  // Detect tech stack
  const languages = detectLanguages(fileIndex);
  const buildTools = detectBuildTools(fileIndex);
  const frameworks = detectFrameworks(fileIndex, dependencies);

  const techStack: RepoIndexTechStack = {
    languages,
    frameworks,
    buildTools,
    packageManager: buildTools.find((t) =>
      ["npm", "yarn", "pnpm", "bun"].includes(t),
    ),
  };

  // Find entry points
  const entryPoints = await findEntryPoints(repoPath, fileIndex);

  // Count files (not directories)
  const fileCount = fileIndex.filter((f) => f.type === "file").length;

  // Symbol count will be populated by AST parser (future enhancement)
  const symbolCount = 0;

  onProgress?.({ phase: "complete", filesScanned: fileCount });

  return {
    fileCount,
    symbolCount,
    techStack,
    entryPoints,
    dependencies,
    fileIndex,
  };
}
