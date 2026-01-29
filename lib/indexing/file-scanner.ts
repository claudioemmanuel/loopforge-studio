/**
 * File Scanner
 *
 * Walks a repository directory tree and collects file entries,
 * skipping non-indexable directories and files.
 */

import fs from "fs/promises";
import path from "path";
import type { RepoIndexFileEntry } from "@/lib/db/schema";
import type { IndexingProgress } from "./types";

// Directories to skip during indexing
export const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".nuxt",
  "dist",
  "build",
  "out",
  ".cache",
  "coverage",
  ".turbo",
  ".vercel",
  "__pycache__",
  ".pytest_cache",
  "venv",
  ".venv",
  "vendor",
  "target",
  ".idea",
  ".vscode",
]);

// File extensions to index
export const INDEXABLE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".rb",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".swift",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".cs",
  ".php",
  ".vue",
  ".svelte",
  ".astro",
  ".md",
  ".mdx",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".sql",
  ".graphql",
  ".gql",
  ".css",
  ".scss",
  ".less",
  ".html",
]);

/**
 * Walk directory and collect file entries
 */
export async function walkDirectory(
  dirPath: string,
  basePath: string,
  onProgress?: (progress: IndexingProgress) => void,
): Promise<RepoIndexFileEntry[]> {
  const entries: RepoIndexFileEntry[] = [];
  let filesScanned = 0;

  async function walk(currentPath: string): Promise<void> {
    const items = await fs.readdir(currentPath, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(currentPath, item.name);
      const relativePath = path.relative(basePath, fullPath);

      if (item.isDirectory()) {
        if (!SKIP_DIRS.has(item.name)) {
          entries.push({
            path: relativePath,
            type: "directory",
          });
          await walk(fullPath);
        }
      } else if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase();

        if (INDEXABLE_EXTENSIONS.has(ext) || item.name.startsWith(".")) {
          try {
            const stat = await fs.stat(fullPath);
            entries.push({
              path: relativePath,
              type: "file",
              extension: ext || undefined,
              size: stat.size,
              lastModified: stat.mtime.toISOString(),
            });

            filesScanned++;
            if (onProgress && filesScanned % 100 === 0) {
              onProgress({
                phase: "scanning",
                filesScanned,
                currentPath: relativePath,
              });
            }
          } catch {
            // Skip files we can't stat
          }
        }
      }
    }
  }

  await walk(dirPath);
  return entries;
}
