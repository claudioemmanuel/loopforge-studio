/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from "vitest";
import { readSourceFile } from "../../helpers/source-file";

/**
 * Tests for Repository Setup Modal component
 * These tests verify the modal behavior for setting up repository local paths,
 * clone status checking, verification flow, and polling for indexing status
 */

describe("RepoSetupModal", () => {
  let modalContent: string;

  beforeEach(() => {
    modalContent = readSourceFile(
      __dirname,
      "components/modals/repo-setup-modal.tsx",
    );
  });

  describe("Initial render", () => {
    it("should render all repos in pending state", () => {
      // Check initial state setup for repos
      expect(modalContent).toContain('status: "pending" as const');
      expect(modalContent).toContain("useState<RepoSetupItem[]>");
    });

    it("should show modal header with title", () => {
      expect(modalContent).toContain("Setup Repositories");
      expect(modalContent).toContain(
        "Point to your local clones for these repositories",
      );
    });

    it("should show 'Skip for now' button when no repos are ready", () => {
      // Button text changes based on hasReadyRepos state
      expect(modalContent).toContain("Skip for now");
      expect(modalContent).toContain(
        'allReposReady || hasReadyRepos ? "Done" : "Skip for now"',
      );
    });

    it("should have FolderGit2 icon in header", () => {
      expect(modalContent).toContain("<FolderGit2");
    });
  });

  describe("Clone status check on mount", () => {
    it("should fetch clone-status for each repo on mount", () => {
      // Verify useEffect fetches clone-status
      expect(modalContent).toContain("useEffect(() => {");
      expect(modalContent).toContain("/api/repos/${repoId}/clone-status");
      expect(modalContent).toContain("checkStatuses();");
    });

    it("should update repo status to 'ready' if already indexed", () => {
      expect(modalContent).toContain('data.indexingStatus === "indexed"');
      expect(modalContent).toContain('? "ready"');
    });

    it("should update repo status to 'indexing' if currently indexing", () => {
      expect(modalContent).toContain('data.indexingStatus === "indexing"');
      expect(modalContent).toContain('? "indexing"');
    });

    it("should keep pending status if not cloned", () => {
      expect(modalContent).toContain("status: data.isCloned");
      expect(modalContent).toContain(': "pending"');
    });

    it("should store isCloned from API response", () => {
      expect(modalContent).toContain("isCloned: data.isCloned");
    });

    it("should store indexingStatus from API response", () => {
      expect(modalContent).toContain("indexingStatus: data.indexingStatus");
    });
  });

  describe("Path selection", () => {
    it("should display suggested paths when available", () => {
      expect(modalContent).toContain("suggestedPaths");
      expect(modalContent).toContain("Found on your machine:");
      expect(modalContent).toContain("{repo.suggestedPaths.map((path)");
    });

    it("should highlight selected path", () => {
      expect(modalContent).toContain("repo.selectedPath === path");
      expect(modalContent).toContain(
        "bg-primary/10 border-primary/30 text-primary",
      );
    });

    it("should allow custom path input", () => {
      expect(modalContent).toContain('placeholder="Or enter custom path');
      expect(modalContent).toContain("handleCustomPathChange");
      expect(modalContent).toContain("customPath");
    });

    it("should clear selectedPath when custom path is entered", () => {
      // handleCustomPathChange sets selectedPath to value or undefined
      expect(modalContent).toContain("selectedPath: value || undefined");
    });

    it("should have handlePathSelect function", () => {
      expect(modalContent).toContain(
        "const handlePathSelect = (repoId: string, path: string)",
      );
      expect(modalContent).toContain('customPath: ""');
    });
  });

  describe("Setup flow", () => {
    it("should call verify-local API when Setup Selected is clicked", () => {
      expect(modalContent).toContain("/api/repos/${repo.id}/verify-local");
      expect(modalContent).toContain('method: "POST"');
      expect(modalContent).toContain("localPath: pathToVerify");
    });

    it("should show 'verifying' status during verification", () => {
      expect(modalContent).toContain('status: "verifying"');
      expect(modalContent).toContain("Verifying...");
    });

    it("should transition to 'indexing' on successful verification", () => {
      expect(modalContent).toContain("data.verified && data.matchesRemote");
      expect(modalContent).toContain('status: "indexing", isCloned: true');
    });

    it("should trigger indexing API after successful verification", () => {
      expect(modalContent).toContain("/api/repos/${repo.id}/index");
      expect(modalContent).toContain('method: "POST"');
    });

    it("should show error message when verification fails", () => {
      expect(modalContent).toContain("errorMessage:");
      expect(modalContent).toContain(
        "Path exists but doesn't match this repository",
      );
      expect(modalContent).toContain("Path not found or not a git repository");
      expect(modalContent).toContain("Failed to verify path");
    });

    it("should show retry button on error", () => {
      expect(modalContent).toContain("handleRetry");
      expect(modalContent).toContain("<RefreshCw");
      expect(modalContent).toContain('repo.status === "error"');
    });
  });

  describe("Polling", () => {
    it("should poll clone-status every 2s for indexing repos", () => {
      expect(modalContent).toContain("setInterval(async ()");
      expect(modalContent).toContain("}, 2000)");
      expect(modalContent).toContain('r.status === "indexing"');
    });

    it("should use memoized list of indexing repo IDs", () => {
      expect(modalContent).toContain("const indexingRepoIds = useMemo(");
      expect(modalContent).toContain("[repoItems]");
    });

    it("should transition to 'ready' when indexing completes", () => {
      // In polling effect
      expect(modalContent).toContain('data.indexingStatus === "indexed"');
      expect(modalContent).toContain('? "ready"');
    });

    it("should transition to 'error' when indexing fails", () => {
      expect(modalContent).toContain('data.indexingStatus === "failed"');
      expect(modalContent).toContain('? "error"');
      expect(modalContent).toContain('"Indexing failed"');
    });

    it("should stop polling when no repos are indexing", () => {
      expect(modalContent).toContain(
        "if (indexingRepoIds.length === 0) return",
      );
      expect(modalContent).toContain("return () => clearInterval(interval)");
    });
  });

  describe("Button states", () => {
    it("should show 'Done' button when any repo is ready", () => {
      expect(modalContent).toContain(
        'const hasReadyRepos = repoItems.some((r) => r.status === "ready")',
      );
      expect(modalContent).toContain('hasReadyRepos ? "Done"');
    });

    it("should show 'Setup Selected' only when pending repos have paths", () => {
      expect(modalContent).toContain("const hasPendingSetup = repoItems.some(");
      expect(modalContent).toContain(
        'r.status === "pending" && (r.selectedPath || r.customPath)',
      );
      expect(modalContent).toContain("{hasPendingSetup && (");
      expect(modalContent).toContain("Setup Selected");
    });

    it("should disable buttons while processing", () => {
      expect(modalContent).toContain("disabled={isProcessing}");
    });

    it("should show loading state on Setup button", () => {
      expect(modalContent).toContain("<Loader2");
      expect(modalContent).toContain("animate-spin");
      expect(modalContent).toContain("Setting up...");
    });
  });

  describe("Callbacks", () => {
    it("should call onClose when backdrop is clicked", () => {
      expect(modalContent).toContain("onClick={onClose}");
      expect(modalContent).toContain("bg-black/60 backdrop-blur-sm");
    });

    it("should call onClose when X button is clicked", () => {
      expect(modalContent).toContain("<X className");
      expect(modalContent).toContain("onClick={onClose}");
    });

    it("should call onComplete when Done is clicked", () => {
      expect(modalContent).toContain(
        "onClick={allReposReady || hasReadyRepos ? onComplete : onClose}",
      );
    });

    it("should have proper prop types for callbacks", () => {
      expect(modalContent).toContain("onClose: () => void");
      expect(modalContent).toContain("onComplete: () => void");
    });
  });

  describe("Status display", () => {
    it("should show correct status icon for each state", () => {
      expect(modalContent).toContain("getStatusIcon");
      expect(modalContent).toContain(
        '<CheckCircle2 className="w-5 h-5 text-green-500"',
      );
      expect(modalContent).toContain(
        '<Loader2 className="w-5 h-5 text-primary animate-spin"',
      );
      expect(modalContent).toContain(
        '<AlertCircle className="w-5 h-5 text-red-500"',
      );
      expect(modalContent).toContain(
        '<FolderSearch className="w-5 h-5 text-muted-foreground"',
      );
    });

    it("should show correct status text for each state", () => {
      expect(modalContent).toContain("getStatusText");
      expect(modalContent).toContain('return "Ready"');
      expect(modalContent).toContain('return "Indexing..."');
      expect(modalContent).toContain('return "Cloning..."');
      expect(modalContent).toContain('return "Verifying..."');
      expect(modalContent).toContain('return "Select local path"');
    });

    it("should show progress count in footer", () => {
      expect(modalContent).toContain(
        '{repoItems.filter((r) => r.status === "ready").length}',
      );
      expect(modalContent).toContain("repositories ready");
    });
  });

  describe("Visual styling", () => {
    it("should have proper modal styling", () => {
      expect(modalContent).toContain("fixed inset-0 z-50");
      expect(modalContent).toContain("max-w-2xl");
      expect(modalContent).toContain("bg-card rounded-2xl shadow-2xl border");
    });

    it("should have animation classes", () => {
      expect(modalContent).toContain("animate-in zoom-in-95 fade-in");
    });

    it("should style ready repos differently", () => {
      expect(modalContent).toContain('repo.status === "ready"');
      expect(modalContent).toContain("bg-green-500/5 border-green-500/20");
    });

    it("should style error repos differently", () => {
      expect(modalContent).toContain('repo.status === "error"');
      expect(modalContent).toContain("bg-red-500/5 border-red-500/20");
    });
  });

  describe("Component structure", () => {
    it("should be a client component", () => {
      expect(modalContent).toContain('"use client"');
    });

    it("should import required hooks", () => {
      expect(modalContent).toContain("useState");
      expect(modalContent).toContain("useEffect");
      expect(modalContent).toContain("useMemo");
    });

    it("should have proper interface for RepoSetupItem", () => {
      expect(modalContent).toContain("interface RepoSetupItem");
      expect(modalContent).toContain("id: string");
      expect(modalContent).toContain("name: string");
      expect(modalContent).toContain("fullName: string");
      expect(modalContent).toContain("suggestedPaths?: string[]");
      expect(modalContent).toContain("selectedPath?: string");
      expect(modalContent).toContain("customPath?: string");
      expect(modalContent).toContain(
        'status: "pending" | "verifying" | "cloning" | "indexing" | "ready" | "error"',
      );
      expect(modalContent).toContain("errorMessage?: string");
      expect(modalContent).toContain("isCloned?: boolean");
      expect(modalContent).toContain("indexingStatus?: IndexingStatus");
    });

    it("should have proper interface for RepoSetupModalProps", () => {
      expect(modalContent).toContain("interface RepoSetupModalProps");
      expect(modalContent).toContain("repos: Array<{");
      expect(modalContent).toContain("onClose: () => void");
      expect(modalContent).toContain("onComplete: () => void");
    });
  });
});
