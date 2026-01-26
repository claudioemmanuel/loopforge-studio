/**
 * GitHub Repository Scanner
 *
 * Scans repositories via GitHub API to extract context for brainstorming.
 * Unlike the filesystem-based scanRepository(), this works with repos before they're cloned.
 */

import { githubLogger } from "@/lib/logger";

export interface GitHubRepoContext {
  techStack: string[];
  fileStructure: string[];
  configFiles: string[];
  testFiles: { path: string; name: string }[];
  sourceFiles: { path: string; name: string }[];
}

interface TreeEntry {
  path?: string;
  mode?: string;
  type?: string;
  sha?: string;
  size?: number;
  url?: string;
}

interface FileInfo {
  path: string;
  name: string;
}

/**
 * Scan a GitHub repository via the API to extract context.
 * This is used during brainstorming before the repo is cloned.
 */
export async function scanRepoViaGitHub(
  githubToken: string,
  owner: string,
  repo: string,
  branch: string = "main",
): Promise<GitHubRepoContext> {
  try {
    // Get repo tree (recursive for full structure)
    const treeResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
      {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      },
    );

    if (!treeResponse.ok) {
      githubLogger.error(
        { status: treeResponse.status },
        "Failed to fetch tree",
      );
      return getDefaultRepoContext();
    }

    const treeData = await treeResponse.json();
    const entries: TreeEntry[] = treeData.tree || [];

    // Parse structure
    const fileStructure = extractDirectories(entries);
    const configFiles = findConfigFiles(entries);
    const testFiles = findTestFiles(entries);
    const sourceFiles = findSourceFiles(entries);

    // Detect tech stack from config files and file patterns
    const techStack = await detectTechStack(
      githubToken,
      owner,
      repo,
      branch,
      configFiles,
      entries,
    );

    return {
      techStack: [...new Set(techStack)], // Dedupe
      fileStructure: fileStructure.slice(0, 20), // Limit to 20 entries
      configFiles,
      testFiles: testFiles.slice(0, 50), // Limit
      sourceFiles: sourceFiles.slice(0, 100), // Limit
    };
  } catch (error) {
    githubLogger.error({ error }, "Error scanning repository");
    return getDefaultRepoContext();
  }
}

/**
 * Extract top-level directories from the tree.
 */
function extractDirectories(entries: TreeEntry[]): string[] {
  const dirs = new Set<string>();

  for (const entry of entries) {
    if (!entry.path) continue;

    // Skip hidden dirs and node_modules
    if (entry.path.startsWith(".") || entry.path.includes("node_modules"))
      continue;

    // Get first path segment for top-level structure
    const firstSegment = entry.path.split("/")[0];
    if (entry.type === "tree" && !entry.path.includes("/")) {
      dirs.add(`${firstSegment}/`);
    } else if (entry.type === "blob" && !entry.path.includes("/")) {
      dirs.add(firstSegment);
    }
  }

  return Array.from(dirs).sort();
}

/**
 * Find common config files.
 */
function findConfigFiles(entries: TreeEntry[]): string[] {
  const configPatterns = [
    "package.json",
    "tsconfig.json",
    "next.config.ts",
    "next.config.js",
    "next.config.mjs",
    "tailwind.config.ts",
    "tailwind.config.js",
    "drizzle.config.ts",
    "drizzle.config.js",
    "vitest.config.ts",
    "jest.config.ts",
    "jest.config.js",
    "eslint.config.js",
    ".eslintrc.js",
    ".eslintrc.json",
    "Cargo.toml",
    "pyproject.toml",
    "go.mod",
    "pom.xml",
    "build.gradle",
  ];

  return entries
    .filter(
      (e) => e.type === "blob" && e.path && configPatterns.includes(e.path),
    )
    .map((e) => e.path!);
}

/**
 * Find test files in the repository.
 */
function findTestFiles(entries: TreeEntry[]): FileInfo[] {
  return entries
    .filter(
      (e) =>
        e.type === "blob" &&
        e.path &&
        (e.path.includes(".test.") ||
          e.path.includes(".spec.") ||
          e.path.includes("__tests__/") ||
          e.path.includes("/test/") ||
          e.path.includes("/tests/")),
    )
    .map((e) => ({
      path: e.path!,
      name: e.path!.split("/").pop()!,
    }));
}

/**
 * Find source files (TypeScript/JavaScript, excluding tests).
 */
function findSourceFiles(entries: TreeEntry[]): FileInfo[] {
  return entries
    .filter(
      (e) =>
        e.type === "blob" &&
        e.path &&
        (e.path.endsWith(".ts") ||
          e.path.endsWith(".tsx") ||
          e.path.endsWith(".js") ||
          e.path.endsWith(".jsx")) &&
        !e.path.includes(".test.") &&
        !e.path.includes(".spec.") &&
        !e.path.includes("__tests__/") &&
        !e.path.includes("node_modules/"),
    )
    .map((e) => ({
      path: e.path!,
      name: e.path!.split("/").pop()!,
    }));
}

/**
 * Detect tech stack from config files and optionally read package.json.
 */
async function detectTechStack(
  githubToken: string,
  owner: string,
  repo: string,
  branch: string,
  configFiles: string[],
  entries: TreeEntry[],
): Promise<string[]> {
  const techStack: string[] = [];

  // Detect from config file presence
  const configTechMap: Record<string, string> = {
    "package.json": "Node.js",
    "tsconfig.json": "TypeScript",
    "next.config.ts": "Next.js",
    "next.config.js": "Next.js",
    "next.config.mjs": "Next.js",
    "tailwind.config.ts": "Tailwind CSS",
    "tailwind.config.js": "Tailwind CSS",
    "drizzle.config.ts": "Drizzle ORM",
    "drizzle.config.js": "Drizzle ORM",
    "vitest.config.ts": "Vitest",
    "jest.config.ts": "Jest",
    "jest.config.js": "Jest",
    "Cargo.toml": "Rust",
    "pyproject.toml": "Python",
    "go.mod": "Go",
    "pom.xml": "Java/Maven",
    "build.gradle": "Java/Gradle",
  };

  for (const config of configFiles) {
    if (configTechMap[config]) {
      techStack.push(configTechMap[config]);
    }
  }

  // Try to read package.json for more detailed detection
  if (configFiles.includes("package.json")) {
    try {
      const pkgResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/package.json?ref=${branch}`,
        {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github.v3+json",
          },
        },
      );

      if (pkgResponse.ok) {
        const pkgData = await pkgResponse.json();
        if (pkgData.content) {
          const content = Buffer.from(pkgData.content, "base64").toString(
            "utf-8",
          );
          const pkg = JSON.parse(content);
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };

          if (deps["react"]) techStack.push("React");
          if (deps["vue"]) techStack.push("Vue");
          if (deps["drizzle-orm"]) techStack.push("Drizzle ORM");
          if (deps["prisma"]) techStack.push("Prisma");
          if (deps["next-auth"] || deps["@auth/core"])
            techStack.push("NextAuth");
          if (deps["stripe"]) techStack.push("Stripe");
          if (deps["express"]) techStack.push("Express");
          if (deps["fastify"]) techStack.push("Fastify");
          if (deps["hono"]) techStack.push("Hono");
          if (deps["trpc"] || deps["@trpc/server"]) techStack.push("tRPC");
          if (deps["zod"]) techStack.push("Zod");
          if (deps["vitest"]) techStack.push("Vitest");
          if (deps["jest"]) techStack.push("Jest");
        }
      }
    } catch (error) {
      githubLogger.error({ error }, "Error reading package.json");
    }
  }

  return techStack;
}

/**
 * Get a default repo context when scanning fails.
 */
export function getDefaultRepoContext(): GitHubRepoContext {
  return {
    techStack: [],
    fileStructure: [],
    configFiles: [],
    testFiles: [],
    sourceFiles: [],
  };
}

/**
 * Get test coverage context for test-related tasks.
 */
export function getTestCoverageContext(context: GitHubRepoContext): string {
  const { testFiles, sourceFiles } = context;

  if (testFiles.length === 0 && sourceFiles.length === 0) {
    return "";
  }

  // Find source files without corresponding tests
  const testedPaths = new Set(
    testFiles.map((t) =>
      t.path
        .replace(".test.", ".")
        .replace(".spec.", ".")
        .replace("__tests__/", "")
        .replace("/test/", "/")
        .replace("/tests/", "/"),
    ),
  );

  const untestedFiles = sourceFiles.filter((s) => {
    const possibleTestPaths = [
      s.path.replace(".ts", ".test.ts"),
      s.path.replace(".tsx", ".test.tsx"),
      s.path.replace(".ts", ".spec.ts"),
      s.path.replace(".tsx", ".spec.tsx"),
    ];
    return !possibleTestPaths.some((p) =>
      testFiles.some((t) => t.path.endsWith(p.split("/").pop()!)),
    );
  });

  const lines: string[] = [];
  lines.push(`\n\nTEST COVERAGE CONTEXT:`);
  lines.push(`- Existing test files: ${testFiles.length}`);
  lines.push(`- Source files: ${sourceFiles.length}`);
  lines.push(`- Files potentially without tests: ${untestedFiles.length}`);

  if (testFiles.length > 0) {
    lines.push(`\nExisting tests (sample):`);
    testFiles.slice(0, 10).forEach((t) => lines.push(`  - ${t.path}`));
  }

  if (untestedFiles.length > 0) {
    lines.push(`\nFiles likely needing tests (sample):`);
    untestedFiles.slice(0, 15).forEach((f) => lines.push(`  - ${f.path}`));
  }

  return lines.join("\n");
}
