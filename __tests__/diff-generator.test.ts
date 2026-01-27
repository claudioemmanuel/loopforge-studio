import { describe, it, expect } from "vitest";
import {
  generateDiff,
  detectLanguage,
  countChanges,
  calculateDiffSummary,
  type FileChange,
} from "@/lib/ralph/diff-generator";

describe("Diff Generator", () => {
  describe("detectLanguage", () => {
    it("should detect JavaScript files", () => {
      expect(detectLanguage("app.js")).toBe("javascript");
      expect(detectLanguage("utils.mjs")).toBe("javascript");
    });

    it("should detect TypeScript files", () => {
      expect(detectLanguage("component.ts")).toBe("typescript");
      expect(detectLanguage("component.tsx")).toBe("typescript");
    });

    it("should detect Python files", () => {
      expect(detectLanguage("script.py")).toBe("python");
    });

    it("should detect JSON files", () => {
      expect(detectLanguage("package.json")).toBe("json");
    });

    it("should return plaintext for unknown extensions", () => {
      expect(detectLanguage("readme")).toBe("plaintext");
    });

    it("should detect special filenames", () => {
      expect(detectLanguage("Makefile")).toBe("makefile");
      expect(detectLanguage("Dockerfile")).toBe("dockerfile");
    });
  });

  describe("countChanges", () => {
    it("should count additions and deletions", () => {
      const patch = `--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,4 @@
 const a = 1;
-const b = 2;
+const b = 3;
+const c = 4;
 export { a, b };`;

      const { additions, deletions } = countChanges(patch);
      expect(additions).toBe(2);
      expect(deletions).toBe(1);
    });

    it("should ignore --- and +++ lines", () => {
      const patch = `--- a/file.ts
+++ b/file.ts
@@ -1 +1 @@
-old line
+new line`;

      const { additions, deletions } = countChanges(patch);
      expect(additions).toBe(1);
      expect(deletions).toBe(1);
    });

    it("should handle empty patch", () => {
      const { additions, deletions } = countChanges("");
      expect(additions).toBe(0);
      expect(deletions).toBe(0);
    });
  });

  describe("generateDiff", () => {
    it("should generate diff for new file", () => {
      const change: FileChange = {
        path: "src/new.ts",
        action: "create",
        oldContent: null,
        newContent: "export const value = 42;",
      };

      const result = generateDiff(change);

      expect(result.path).toBe("src/new.ts");
      expect(result.action).toBe("create");
      expect(result.language).toBe("typescript");
      expect(result.additions).toBeGreaterThan(0);
      expect(result.deletions).toBe(0);
      expect(result.diffPatch).toContain("+export const value = 42;");
    });

    it("should generate diff for modified file", () => {
      const change: FileChange = {
        path: "src/config.ts",
        action: "modify",
        oldContent: "export const DEBUG = false;",
        newContent: "export const DEBUG = true;",
      };

      const result = generateDiff(change);

      expect(result.action).toBe("modify");
      expect(result.diffPatch).toContain("-export const DEBUG = false;");
      expect(result.diffPatch).toContain("+export const DEBUG = true;");
    });

    it("should generate diff for deleted file", () => {
      const change: FileChange = {
        path: "src/old.ts",
        action: "delete",
        oldContent: "const toDelete = true;",
        newContent: "",
      };

      const result = generateDiff(change);

      expect(result.action).toBe("delete");
      expect(result.deletions).toBeGreaterThan(0);
      expect(result.additions).toBe(0);
    });

    it("should handle multiline content", () => {
      const change: FileChange = {
        path: "src/multi.ts",
        action: "create",
        oldContent: null,
        newContent: `function greet() {
  console.log("Hello");
}

export { greet };`,
      };

      const result = generateDiff(change);

      expect(result.additions).toBe(5);
      expect(result.diffPatch).toContain("+function greet() {");
    });
  });

  describe("calculateDiffSummary", () => {
    it("should calculate summary from multiple diffs", () => {
      const diffs = [
        {
          path: "file1.ts",
          action: "create" as const,
          oldContent: null,
          newContent: "new",
          diffPatch: "+new",
          language: "typescript",
          additions: 5,
          deletions: 0,
        },
        {
          path: "file2.ts",
          action: "modify" as const,
          oldContent: "old",
          newContent: "new",
          diffPatch: "-old\n+new",
          language: "typescript",
          additions: 3,
          deletions: 2,
        },
        {
          path: "file3.ts",
          action: "delete" as const,
          oldContent: "deleted",
          newContent: "",
          diffPatch: "-deleted",
          language: "typescript",
          additions: 0,
          deletions: 4,
        },
      ];

      const summary = calculateDiffSummary(diffs);

      expect(summary.filesChanged).toBe(3);
      expect(summary.additions).toBe(8);
      expect(summary.deletions).toBe(6);
      expect(summary.filesCreated).toBe(1);
      expect(summary.filesModified).toBe(1);
      expect(summary.filesDeleted).toBe(1);
    });

    it("should handle empty array", () => {
      const summary = calculateDiffSummary([]);

      expect(summary.filesChanged).toBe(0);
      expect(summary.additions).toBe(0);
      expect(summary.deletions).toBe(0);
    });
  });
});
