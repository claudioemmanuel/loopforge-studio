/**
 * Tech Stack Detection
 *
 * Detects languages, frameworks, and build tools present in a repository
 * based on file extensions, file names, and dependency lists.
 */

import path from "path";
import type { RepoIndexFileEntry, RepoIndexDependency } from "@/lib/db/schema";

// Framework detection patterns
export const FRAMEWORK_PATTERNS: Record<
  string,
  { files: string[]; deps: string[] }
> = {
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
export const BUILD_TOOLS: Record<string, string[]> = {
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
export const LANGUAGE_EXTENSIONS: Record<string, string> = {
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

/**
 * Detect languages used in the repository
 */
export function detectLanguages(files: RepoIndexFileEntry[]): string[] {
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
export function detectBuildTools(files: RepoIndexFileEntry[]): string[] {
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
export function detectFrameworks(
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
