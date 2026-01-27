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

// Directories to skip during indexing
const SKIP_DIRS = new Set([
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
const INDEXABLE_EXTENSIONS = new Set([
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

// Framework detection patterns
const FRAMEWORK_PATTERNS: Record<string, { files: string[]; deps: string[] }> =
  {
    "Next.js": {
      files: ["next.config.js", "next.config.ts", "next.config.mjs"],
      deps: ["next"],
    },
    React: { files: [], deps: ["react", "react-dom"] },
    Vue: {
      files: ["vue.config.js", "nuxt.config.js", "nuxt.config.ts"],
      deps: ["vue"],
    },
    Nuxt: { files: ["nuxt.config.js", "nuxt.config.ts"], deps: ["nuxt"] },
    Svelte: { files: ["svelte.config.js"], deps: ["svelte"] },
    SvelteKit: { files: ["svelte.config.js"], deps: ["@sveltejs/kit"] },
    Astro: { files: ["astro.config.mjs", "astro.config.ts"], deps: ["astro"] },
    Express: { files: [], deps: ["express"] },
    Fastify: { files: [], deps: ["fastify"] },
    NestJS: { files: ["nest-cli.json"], deps: ["@nestjs/core"] },
    Django: { files: ["manage.py", "settings.py"], deps: ["django"] },
    Flask: { files: [], deps: ["flask"] },
    FastAPI: { files: [], deps: ["fastapi"] },
    Rails: { files: ["Gemfile", "config/routes.rb"], deps: ["rails"] },
    "Ruby on Rails": { files: ["Gemfile"], deps: ["rails"] },
    Laravel: {
      files: ["artisan", "composer.json"],
      deps: ["laravel/framework"],
    },
    Spring: { files: ["pom.xml"], deps: ["spring-boot"] },
    Gin: { files: ["go.mod"], deps: ["github.com/gin-gonic/gin"] },
    Echo: { files: ["go.mod"], deps: ["github.com/labstack/echo"] },
    Actix: { files: ["Cargo.toml"], deps: ["actix-web"] },
    Rocket: { files: ["Cargo.toml"], deps: ["rocket"] },
  };

// Build tool detection
const BUILD_TOOLS: Record<string, string[]> = {
  npm: ["package-lock.json"],
  yarn: ["yarn.lock"],
  pnpm: ["pnpm-lock.yaml"],
  bun: ["bun.lockb"],
  pip: ["requirements.txt", "Pipfile"],
  poetry: ["pyproject.toml", "poetry.lock"],
  cargo: ["Cargo.toml", "Cargo.lock"],
  go: ["go.mod", "go.sum"],
  maven: ["pom.xml"],
  gradle: ["build.gradle", "build.gradle.kts"],
  bundler: ["Gemfile", "Gemfile.lock"],
  composer: ["composer.json", "composer.lock"],
  cmake: ["CMakeLists.txt"],
  make: ["Makefile"],
};

// Language detection by extension
const LANGUAGE_EXTENSIONS: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript",
  ".py": "Python",
  ".rb": "Ruby",
  ".go": "Go",
  ".rs": "Rust",
  ".java": "Java",
  ".kt": "Kotlin",
  ".swift": "Swift",
  ".c": "C",
  ".cpp": "C++",
  ".h": "C/C++",
  ".hpp": "C++",
  ".cs": "C#",
  ".php": "PHP",
  ".vue": "Vue",
  ".svelte": "Svelte",
};

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

/**
 * Walk directory and collect file entries
 */
async function walkDirectory(
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

/**
 * Detect languages used in the repository
 */
function detectLanguages(files: RepoIndexFileEntry[]): string[] {
  const languageCounts = new Map<string, number>();

  for (const file of files) {
    if (file.type === "file" && file.extension) {
      const lang = LANGUAGE_EXTENSIONS[file.extension];
      if (lang) {
        languageCounts.set(lang, (languageCounts.get(lang) || 0) + 1);
      }
    }
  }

  // Sort by count and return top languages
  return Array.from(languageCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([lang]) => lang);
}

/**
 * Detect build tools from files present
 */
function detectBuildTools(files: RepoIndexFileEntry[]): string[] {
  const fileNames = new Set(files.map((f) => path.basename(f.path)));
  const detected: string[] = [];

  for (const [tool, indicators] of Object.entries(BUILD_TOOLS)) {
    if (indicators.some((file) => fileNames.has(file))) {
      detected.push(tool);
    }
  }

  return detected;
}

/**
 * Detect frameworks from files and dependencies
 */
function detectFrameworks(
  files: RepoIndexFileEntry[],
  dependencies: RepoIndexDependency[],
): string[] {
  const fileNames = new Set(files.map((f) => f.path));
  const depNames = new Set(dependencies.map((d) => d.name));
  const detected: string[] = [];

  for (const [framework, { files: frameworkFiles, deps }] of Object.entries(
    FRAMEWORK_PATTERNS,
  )) {
    const hasFile = frameworkFiles.some((f) => fileNames.has(f));
    const hasDep = deps.some((d) => depNames.has(d));

    if (hasFile || hasDep) {
      detected.push(framework);
    }
  }

  return detected;
}

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

export { walkDirectory, detectLanguages, detectBuildTools, detectFrameworks };
