import { describe, it, expect, vi, beforeEach } from "vitest";
import simpleGit from "simple-git";

// Mock simple-git
vi.mock("simple-git", () => ({
  default: vi.fn(),
}));

describe("Git Operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("commitChanges", () => {
    it("should stage files and create commit", async () => {
      const mockAdd = vi.fn().mockResolvedValue(undefined);
      const mockCommit = vi.fn().mockResolvedValue({ commit: "abc123" });

      vi.mocked(simpleGit).mockReturnValue({
        add: mockAdd,
        commit: mockCommit,
      } as unknown as ReturnType<typeof simpleGit>);

      const { commitChanges } = await import("@/lib/ralph/git-operations");

      const result = await commitChanges(
        "/repo",
        ["file1.ts", "file2.ts"],
        "Test commit",
      );

      expect(mockAdd).toHaveBeenCalledWith(["file1.ts", "file2.ts"]);
      expect(mockCommit).toHaveBeenCalledWith("Test commit");
      expect(result.success).toBe(true);
      expect(result.sha).toBe("abc123");
    });

    it("should handle commit errors", async () => {
      const mockAdd = vi.fn().mockResolvedValue(undefined);
      const mockCommit = vi
        .fn()
        .mockRejectedValue(new Error("Nothing to commit"));

      vi.mocked(simpleGit).mockReturnValue({
        add: mockAdd,
        commit: mockCommit,
      } as unknown as ReturnType<typeof simpleGit>);

      const { commitChanges } = await import("@/lib/ralph/git-operations");

      const result = await commitChanges("/repo", ["file.ts"], "Empty commit");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Nothing to commit");
    });
  });

  describe("revertCommit", () => {
    it("should revert a commit successfully", async () => {
      const mockShow = vi.fn().mockResolvedValue("commit info");
      const mockRevert = vi.fn().mockResolvedValue(undefined);
      const mockCommit = vi.fn().mockResolvedValue({ commit: "revert123" });

      vi.mocked(simpleGit).mockReturnValue({
        show: mockShow,
        revert: mockRevert,
        commit: mockCommit,
      } as unknown as ReturnType<typeof simpleGit>);

      const { revertCommit } = await import("@/lib/ralph/git-operations");

      const result = await revertCommit("/repo", "abc123");

      expect(mockShow).toHaveBeenCalledWith("abc123");
      expect(mockRevert).toHaveBeenCalledWith("abc123", ["--no-commit"]);
      expect(result.success).toBe(true);
      expect(result.revertSha).toBe("revert123");
    });

    it("should fail if commit not found", async () => {
      const mockShow = vi.fn().mockRejectedValue(new Error("bad object"));

      vi.mocked(simpleGit).mockReturnValue({
        show: mockShow,
      } as unknown as ReturnType<typeof simpleGit>);

      const { revertCommit } = await import("@/lib/ralph/git-operations");

      const result = await revertCommit("/repo", "nonexistent");

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should handle conflicts during revert", async () => {
      const mockShow = vi.fn().mockResolvedValue("commit info");
      const mockRevert = vi.fn().mockRejectedValue(new Error("CONFLICT"));
      const mockRaw = vi.fn().mockResolvedValue(undefined);

      vi.mocked(simpleGit).mockReturnValue({
        show: mockShow,
        revert: mockRevert,
        raw: mockRaw,
      } as unknown as ReturnType<typeof simpleGit>);

      const { revertCommit } = await import("@/lib/ralph/git-operations");

      const result = await revertCommit("/repo", "abc123");

      expect(result.success).toBe(false);
      expect(result.error).toContain("conflict");
    });
  });

  describe("getChangedFiles", () => {
    it("should return list of changed files", async () => {
      const mockStatus = vi.fn().mockResolvedValue({
        staged: ["file1.ts"],
        modified: ["file2.ts"],
        created: ["file3.ts"],
        deleted: [],
        renamed: [{ to: "file4.ts" }],
      });

      vi.mocked(simpleGit).mockReturnValue({
        status: mockStatus,
      } as unknown as ReturnType<typeof simpleGit>);

      const { getChangedFiles } = await import("@/lib/ralph/git-operations");

      const files = await getChangedFiles("/repo");

      expect(files).toContain("file1.ts");
      expect(files).toContain("file2.ts");
      expect(files).toContain("file3.ts");
      expect(files).toContain("file4.ts");
    });

    it("should return empty array on error", async () => {
      const mockStatus = vi.fn().mockRejectedValue(new Error("git error"));

      vi.mocked(simpleGit).mockReturnValue({
        status: mockStatus,
      } as unknown as ReturnType<typeof simpleGit>);

      const { getChangedFiles } = await import("@/lib/ralph/git-operations");

      const files = await getChangedFiles("/repo");

      expect(files).toEqual([]);
    });
  });

  describe("hasUncommittedChanges", () => {
    it("should return true when changes exist", async () => {
      const mockStatus = vi.fn().mockResolvedValue({
        isClean: () => false,
      });

      vi.mocked(simpleGit).mockReturnValue({
        status: mockStatus,
      } as unknown as ReturnType<typeof simpleGit>);

      const { hasUncommittedChanges } =
        await import("@/lib/ralph/git-operations");

      const result = await hasUncommittedChanges("/repo");

      expect(result).toBe(true);
    });

    it("should return false when no changes", async () => {
      const mockStatus = vi.fn().mockResolvedValue({
        isClean: () => true,
      });

      vi.mocked(simpleGit).mockReturnValue({
        status: mockStatus,
      } as unknown as ReturnType<typeof simpleGit>);

      const { hasUncommittedChanges } =
        await import("@/lib/ralph/git-operations");

      const result = await hasUncommittedChanges("/repo");

      expect(result).toBe(false);
    });
  });

  describe("getCurrentBranch", () => {
    it("should return current branch name", async () => {
      const mockStatus = vi.fn().mockResolvedValue({
        current: "feature/my-branch",
      });

      vi.mocked(simpleGit).mockReturnValue({
        status: mockStatus,
      } as unknown as ReturnType<typeof simpleGit>);

      const { getCurrentBranch } = await import("@/lib/ralph/git-operations");

      const branch = await getCurrentBranch("/repo");

      expect(branch).toBe("feature/my-branch");
    });
  });
});
