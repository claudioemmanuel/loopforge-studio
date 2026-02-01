import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  scanRepoViaGitHub,
  getDefaultRepoContext,
  getTestCoverageContext,
  type GitHubRepoContext,
} from "@/lib/github/repo-scanner";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("repo-scanner", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("scanRepoViaGitHub", () => {
    it("should extract tech stack from tree and package.json", async () => {
      // Mock tree response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            tree: [
              { path: "package.json", type: "blob" },
              { path: "tsconfig.json", type: "blob" },
              { path: "next.config.ts", type: "blob" },
              { path: "app", type: "tree" },
              { path: "lib", type: "tree" },
            ],
          }),
      });

      // Mock package.json response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            content: Buffer.from(
              JSON.stringify({
                dependencies: { react: "^18", "drizzle-orm": "^0.30" },
              })
            ).toString("base64"),
          }),
      });

      const result = await scanRepoViaGitHub("token", "owner", "repo", "main");

      expect(result.techStack).toContain("Node.js");
      expect(result.techStack).toContain("TypeScript");
      expect(result.techStack).toContain("Next.js");
      expect(result.techStack).toContain("React");
      expect(result.techStack).toContain("Drizzle ORM");
    });

    it("should identify test files correctly", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            tree: [
              { path: "__tests__/foo.test.ts", type: "blob" },
              { path: "lib/bar.spec.ts", type: "blob" },
              { path: "test/integration.test.ts", type: "blob" },
              { path: "lib/utils.ts", type: "blob" },
              { path: "app/page.tsx", type: "blob" },
            ],
          }),
      });

      const result = await scanRepoViaGitHub("token", "owner", "repo", "main");

      expect(result.testFiles).toHaveLength(3);
      expect(result.testFiles.map((f) => f.path)).toContain("__tests__/foo.test.ts");
      expect(result.testFiles.map((f) => f.path)).toContain("lib/bar.spec.ts");
      expect(result.testFiles.map((f) => f.path)).toContain("test/integration.test.ts");
    });

    it("should identify source files excluding tests", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            tree: [
              { path: "__tests__/foo.test.ts", type: "blob" },
              { path: "lib/utils.ts", type: "blob" },
              { path: "app/page.tsx", type: "blob" },
              { path: "components/button.tsx", type: "blob" },
            ],
          }),
      });

      const result = await scanRepoViaGitHub("token", "owner", "repo", "main");

      expect(result.sourceFiles).toHaveLength(3);
      expect(result.sourceFiles.map((f) => f.path)).toContain("lib/utils.ts");
      expect(result.sourceFiles.map((f) => f.path)).toContain("app/page.tsx");
      expect(result.sourceFiles.map((f) => f.path)).toContain("components/button.tsx");
      // Should not include test files
      expect(result.sourceFiles.map((f) => f.path)).not.toContain("__tests__/foo.test.ts");
    });

    it("should extract top-level directory structure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            tree: [
              { path: "app", type: "tree" },
              { path: "lib", type: "tree" },
              { path: "components", type: "tree" },
              { path: "package.json", type: "blob" },
              { path: "README.md", type: "blob" },
              { path: "app/page.tsx", type: "blob" },
              { path: "lib/utils.ts", type: "blob" },
            ],
          }),
      });

      const result = await scanRepoViaGitHub("token", "owner", "repo", "main");

      expect(result.fileStructure).toContain("app/");
      expect(result.fileStructure).toContain("lib/");
      expect(result.fileStructure).toContain("components/");
      expect(result.fileStructure).toContain("package.json");
      expect(result.fileStructure).toContain("README.md");
    });

    it("should detect config files", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            tree: [
              { path: "package.json", type: "blob" },
              { path: "tsconfig.json", type: "blob" },
              { path: "vitest.config.ts", type: "blob" },
              { path: "tailwind.config.js", type: "blob" },
              { path: "eslint.config.js", type: "blob" },
              { path: "src/index.ts", type: "blob" },
            ],
          }),
      });

      const result = await scanRepoViaGitHub("token", "owner", "repo", "main");

      expect(result.configFiles).toContain("package.json");
      expect(result.configFiles).toContain("tsconfig.json");
      expect(result.configFiles).toContain("vitest.config.ts");
      expect(result.configFiles).toContain("tailwind.config.js");
      expect(result.configFiles).toContain("eslint.config.js");
    });

    it("should handle API errors gracefully (404)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await scanRepoViaGitHub("token", "owner", "repo", "main");

      // Should return default context
      expect(result.techStack).toEqual([]);
      expect(result.fileStructure).toEqual([]);
      expect(result.configFiles).toEqual([]);
      expect(result.testFiles).toEqual([]);
      expect(result.sourceFiles).toEqual([]);
    });

    it("should handle API errors gracefully (500)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await scanRepoViaGitHub("token", "owner", "repo", "main");

      expect(result).toEqual(getDefaultRepoContext());
    });

    it("should handle network errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await scanRepoViaGitHub("token", "owner", "repo", "main");

      expect(result).toEqual(getDefaultRepoContext());
    });

    it("should handle empty repository", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ tree: [] }),
      });

      const result = await scanRepoViaGitHub("token", "owner", "repo", "main");

      expect(result.techStack).toEqual([]);
      expect(result.fileStructure).toEqual([]);
      expect(result.configFiles).toEqual([]);
      expect(result.testFiles).toEqual([]);
      expect(result.sourceFiles).toEqual([]);
    });

    it("should skip hidden directories and node_modules", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            tree: [
              { path: ".git", type: "tree" },
              { path: ".github", type: "tree" },
              { path: "node_modules", type: "tree" },
              { path: "node_modules/react/index.js", type: "blob" },
              { path: "src", type: "tree" },
              { path: "src/index.ts", type: "blob" },
            ],
          }),
      });

      const result = await scanRepoViaGitHub("token", "owner", "repo", "main");

      expect(result.fileStructure).not.toContain(".git/");
      expect(result.fileStructure).not.toContain(".github/");
      expect(result.fileStructure).toContain("src/");
      // Source files should not include node_modules
      expect(result.sourceFiles.map((f) => f.path)).not.toContain("node_modules/react/index.js");
    });

    it("should dedupe tech stack entries", async () => {
      // Drizzle ORM can be detected from both config file and package.json
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            tree: [
              { path: "package.json", type: "blob" },
              { path: "drizzle.config.ts", type: "blob" },
            ],
          }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            content: Buffer.from(
              JSON.stringify({
                dependencies: { "drizzle-orm": "^0.30" },
              })
            ).toString("base64"),
          }),
      });

      const result = await scanRepoViaGitHub("token", "owner", "repo", "main");

      // Should only appear once despite being detected twice
      const drizzleCount = result.techStack.filter((t) => t === "Drizzle ORM").length;
      expect(drizzleCount).toBe(1);
    });

    it("should handle package.json fetch failure gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            tree: [
              { path: "package.json", type: "blob" },
              { path: "tsconfig.json", type: "blob" },
            ],
          }),
      });

      // package.json fetch fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      const result = await scanRepoViaGitHub("token", "owner", "repo", "main");

      // Should still have tech stack from config files
      expect(result.techStack).toContain("Node.js");
      expect(result.techStack).toContain("TypeScript");
    });

    it("should detect various tech stacks from package.json dependencies", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            tree: [{ path: "package.json", type: "blob" }],
          }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            content: Buffer.from(
              JSON.stringify({
                dependencies: {
                  vue: "^3.0",
                  prisma: "^5.0",
                  express: "^4.0",
                  stripe: "^14.0",
                  zod: "^3.0",
                },
                devDependencies: {
                  vitest: "^1.0",
                },
              })
            ).toString("base64"),
          }),
      });

      const result = await scanRepoViaGitHub("token", "owner", "repo", "main");

      expect(result.techStack).toContain("Vue");
      expect(result.techStack).toContain("Prisma");
      expect(result.techStack).toContain("Express");
      expect(result.techStack).toContain("Stripe");
      expect(result.techStack).toContain("Zod");
      expect(result.techStack).toContain("Vitest");
    });

    it("should use default branch when not specified", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ tree: [] }),
      });

      await scanRepoViaGitHub("token", "owner", "repo");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/git/trees/main"),
        expect.any(Object)
      );
    });

    it("should limit results to prevent oversized responses", async () => {
      // Create many files
      const manyFiles = Array.from({ length: 200 }, (_, i) => ({
        path: `src/file${i}.ts`,
        type: "blob",
      }));

      const manyDirs = Array.from({ length: 30 }, (_, i) => ({
        path: `dir${i}`,
        type: "tree",
      }));

      const manyTests = Array.from({ length: 100 }, (_, i) => ({
        path: `__tests__/test${i}.test.ts`,
        type: "blob",
      }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            tree: [...manyFiles, ...manyDirs, ...manyTests],
          }),
      });

      const result = await scanRepoViaGitHub("token", "owner", "repo", "main");

      // Should be limited
      expect(result.fileStructure.length).toBeLessThanOrEqual(20);
      expect(result.testFiles.length).toBeLessThanOrEqual(50);
      expect(result.sourceFiles.length).toBeLessThanOrEqual(100);
    });
  });

  describe("getTestCoverageContext", () => {
    it("should identify files without tests", () => {
      const context: GitHubRepoContext = {
        techStack: [],
        fileStructure: [],
        configFiles: [],
        testFiles: [{ path: "lib/utils.test.ts", name: "utils.test.ts" }],
        sourceFiles: [
          { path: "lib/utils.ts", name: "utils.ts" },
          { path: "lib/auth.ts", name: "auth.ts" },
        ],
      };

      const result = getTestCoverageContext(context);

      expect(result).toContain("Files potentially without tests: 1");
      expect(result).toContain("auth.ts");
    });

    it("should return empty string when no files", () => {
      const context: GitHubRepoContext = {
        techStack: [],
        fileStructure: [],
        configFiles: [],
        testFiles: [],
        sourceFiles: [],
      };

      const result = getTestCoverageContext(context);
      expect(result).toBe("");
    });

    it("should show existing test files count", () => {
      const context: GitHubRepoContext = {
        techStack: [],
        fileStructure: [],
        configFiles: [],
        testFiles: [
          { path: "__tests__/a.test.ts", name: "a.test.ts" },
          { path: "__tests__/b.test.ts", name: "b.test.ts" },
          { path: "__tests__/c.test.ts", name: "c.test.ts" },
        ],
        sourceFiles: [
          { path: "lib/a.ts", name: "a.ts" },
          { path: "lib/b.ts", name: "b.ts" },
        ],
      };

      const result = getTestCoverageContext(context);

      expect(result).toContain("Existing test files: 3");
      expect(result).toContain("Source files: 2");
    });

    it("should list sample of existing tests", () => {
      const context: GitHubRepoContext = {
        techStack: [],
        fileStructure: [],
        configFiles: [],
        testFiles: [
          { path: "__tests__/auth.test.ts", name: "auth.test.ts" },
          { path: "__tests__/utils.test.ts", name: "utils.test.ts" },
        ],
        sourceFiles: [{ path: "lib/auth.ts", name: "auth.ts" }],
      };

      const result = getTestCoverageContext(context);

      expect(result).toContain("Existing tests (sample):");
      expect(result).toContain("__tests__/auth.test.ts");
      expect(result).toContain("__tests__/utils.test.ts");
    });

    it("should list files needing tests", () => {
      const context: GitHubRepoContext = {
        techStack: [],
        fileStructure: [],
        configFiles: [],
        testFiles: [],
        sourceFiles: [
          { path: "lib/auth.ts", name: "auth.ts" },
          { path: "lib/db.ts", name: "db.ts" },
        ],
      };

      const result = getTestCoverageContext(context);

      expect(result).toContain("Files likely needing tests (sample):");
      expect(result).toContain("lib/auth.ts");
      expect(result).toContain("lib/db.ts");
    });

    it("should handle .spec. test naming convention", () => {
      const context: GitHubRepoContext = {
        techStack: [],
        fileStructure: [],
        configFiles: [],
        testFiles: [{ path: "lib/utils.spec.ts", name: "utils.spec.ts" }],
        sourceFiles: [
          { path: "lib/utils.ts", name: "utils.ts" },
          { path: "lib/helper.ts", name: "helper.ts" },
        ],
      };

      const result = getTestCoverageContext(context);

      // utils.ts should be considered tested (has utils.spec.ts)
      // helper.ts should be listed as needing tests
      expect(result).toContain("helper.ts");
    });
  });

  describe("getDefaultRepoContext", () => {
    it("should return empty context structure", () => {
      const result = getDefaultRepoContext();

      expect(result.techStack).toEqual([]);
      expect(result.fileStructure).toEqual([]);
      expect(result.configFiles).toEqual([]);
      expect(result.testFiles).toEqual([]);
      expect(result.sourceFiles).toEqual([]);
    });

    it("should return a new object each time", () => {
      const result1 = getDefaultRepoContext();
      const result2 = getDefaultRepoContext();

      expect(result1).not.toBe(result2);
      expect(result1).toEqual(result2);
    });
  });
});
