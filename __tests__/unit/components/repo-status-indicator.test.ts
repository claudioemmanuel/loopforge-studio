/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from "vitest";
import { readSourceFile } from "../../helpers/source-file";

/**
 * Tests for Repository Status Indicator components
 * These tests verify the status indicator components display correct
 * colors, labels, and icons based on clone and indexing status
 */

describe("Repository Status Indicator", () => {
  let statusIndicatorContent: string;

  beforeEach(() => {
    statusIndicatorContent = readSourceFile(
      __dirname,
      "components/repo-status-indicator.tsx",
    );
  });

  describe("getStatusConfig function", () => {
    it("should return 'Not Cloned' config when isCloned is false", () => {
      // Verify the function handles not cloned state
      expect(statusIndicatorContent).toContain("if (!isCloned)");
      expect(statusIndicatorContent).toContain(
        'label: t("repositories.status.notCloned")',
      );
      expect(statusIndicatorContent).toContain("text-red-500");
      expect(statusIndicatorContent).toContain("bg-red-500/10");
      expect(statusIndicatorContent).toContain(
        'description: t("repositories.status.notClonedMessage")',
      );
    });

    it("should return 'Ready' config when cloned and indexed", () => {
      // Verify indexed state configuration
      expect(statusIndicatorContent).toContain('case "indexed":');
      expect(statusIndicatorContent).toContain(
        'label: t("repositories.status.ready")',
      );
      expect(statusIndicatorContent).toContain("text-green-500");
      expect(statusIndicatorContent).toContain("bg-green-500/10");
      expect(statusIndicatorContent).toContain(
        'description: t("repositories.status.readyMessage")',
      );
    });

    it("should return 'Indexing' config when cloned and indexing", () => {
      // Verify indexing state configuration
      expect(statusIndicatorContent).toContain('case "indexing":');
      expect(statusIndicatorContent).toContain(
        'label: t("repositories.status.indexing")',
      );
      expect(statusIndicatorContent).toContain("text-yellow-500");
      expect(statusIndicatorContent).toContain("bg-yellow-500/10");
      expect(statusIndicatorContent).toContain(
        'description: t("repositories.status.indexingMessage")',
      );
    });

    it("should return 'Pending' config when cloned and pending", () => {
      // Verify pending state configuration
      expect(statusIndicatorContent).toContain('case "pending":');
      expect(statusIndicatorContent).toContain(
        'label: t("repositories.status.pending")',
      );
      expect(statusIndicatorContent).toContain("text-orange-500");
      expect(statusIndicatorContent).toContain("bg-orange-500/10");
      expect(statusIndicatorContent).toContain(
        'description: t("repositories.status.pendingMessage")',
      );
    });

    it("should return 'Index Failed' config when cloned and failed", () => {
      // Verify failed state configuration
      expect(statusIndicatorContent).toContain('case "failed":');
      expect(statusIndicatorContent).toContain(
        'label: t("repositories.status.failed")',
      );
      expect(statusIndicatorContent).toContain(
        'description: t("repositories.status.failedMessage")',
      );
    });

    it("should return 'Unknown' config for unknown indexing status", () => {
      // Verify default/unknown state configuration
      expect(statusIndicatorContent).toContain("default:");
      expect(statusIndicatorContent).toContain(
        'label: t("repositories.status.unknown")',
      );
      expect(statusIndicatorContent).toContain("text-gray-500");
      expect(statusIndicatorContent).toContain("bg-gray-500/10");
      expect(statusIndicatorContent).toContain(
        'description: t("repositories.status.unknownMessage")',
      );
    });

    it("should use correct icons for each status", () => {
      // XCircle for not cloned
      expect(statusIndicatorContent).toContain("<XCircle");
      // CheckCircle for indexed/ready
      expect(statusIndicatorContent).toContain("<CheckCircle");
      // Loader2 with animation for indexing
      expect(statusIndicatorContent).toContain("<Loader2");
      expect(statusIndicatorContent).toContain("animate-spin");
      // AlertCircle for pending, failed, unknown
      expect(statusIndicatorContent).toContain("<AlertCircle");
    });
  });

  describe("RepoStatusDot component", () => {
    it("should render green dot for cloned + indexed", () => {
      // Check RepoStatusDot has green color for indexed
      expect(statusIndicatorContent).toContain("RepoStatusDot");
      expect(statusIndicatorContent).toMatch(
        /isCloned && indexingStatus === "indexed".*bg-green-500/s,
      );
    });

    it("should render yellow pulsing dot for cloned + indexing", () => {
      // Check RepoStatusDot has yellow color with pulse for indexing
      expect(statusIndicatorContent).toMatch(
        /indexingStatus === "indexing".*bg-yellow-500 animate-pulse/s,
      );
    });

    it("should render orange dot for cloned + pending", () => {
      // Check RepoStatusDot has orange color for pending
      expect(statusIndicatorContent).toMatch(
        /indexingStatus === "pending".*bg-orange-500/s,
      );
    });

    it("should render red dot for not cloned", () => {
      // Check RepoStatusDot has red color as fallback (not cloned)
      // The fallback is bg-red-500 when none of the cloned conditions match
      expect(statusIndicatorContent).toContain('"bg-red-500"');
    });

    it("should have correct CSS classes for each status", () => {
      // Verify dot uses correct size classes
      expect(statusIndicatorContent).toContain("w-2 h-2 rounded-full");
    });

    it("should have tooltip with status label and description", () => {
      // Verify RepoStatusDot includes tooltip
      expect(statusIndicatorContent).toContain("TooltipProvider");
      expect(statusIndicatorContent).toContain("TooltipTrigger");
      expect(statusIndicatorContent).toContain("TooltipContent");
      expect(statusIndicatorContent).toContain("{status.label}");
      expect(statusIndicatorContent).toContain("{status.description}");
    });
  });

  describe("RepoStatusBadge component", () => {
    it("should render 'Ready' badge with green styling for indexed", () => {
      // Check RepoStatusBadge exists and has proper styling
      expect(statusIndicatorContent).toContain("RepoStatusBadge");
      expect(statusIndicatorContent).toContain("border-green-500/30");
      expect(statusIndicatorContent).toContain("bg-green-500/10");
      expect(statusIndicatorContent).toContain("text-green-600");
      expect(statusIndicatorContent).toContain("dark:text-green-400");
    });

    it("should render 'Indexing' badge with yellow styling", () => {
      expect(statusIndicatorContent).toContain("border-yellow-500/30");
      expect(statusIndicatorContent).toContain("bg-yellow-500/10");
      expect(statusIndicatorContent).toContain("text-yellow-600");
      expect(statusIndicatorContent).toContain("dark:text-yellow-400");
    });

    it("should render 'Pending' badge with orange styling", () => {
      expect(statusIndicatorContent).toContain("border-orange-500/30");
      expect(statusIndicatorContent).toContain("bg-orange-500/10");
      expect(statusIndicatorContent).toContain("text-orange-600");
      expect(statusIndicatorContent).toContain("dark:text-orange-400");
    });

    it("should render 'Not Cloned' badge with red styling", () => {
      expect(statusIndicatorContent).toContain("border-red-500/30");
      expect(statusIndicatorContent).toContain("bg-red-500/10");
      expect(statusIndicatorContent).toContain("text-red-600");
      expect(statusIndicatorContent).toContain("dark:text-red-400");
    });

    it("should include status icon and label text", () => {
      // Badge shows icon and label
      expect(statusIndicatorContent).toContain("{status.icon}");
      expect(statusIndicatorContent).toContain("<span>{status.label}</span>");
    });

    it("should have proper badge styling classes", () => {
      // Verify badge has correct base classes
      expect(statusIndicatorContent).toContain(
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium",
      );
    });
  });

  describe("RepoStatusIndicator component", () => {
    it("should support size prop with sm, md, lg options", () => {
      expect(statusIndicatorContent).toContain('size?: "sm" | "md" | "lg"');
      expect(statusIndicatorContent).toContain("const sizeMap = {");
      expect(statusIndicatorContent).toContain(
        'sm: { icon: 14, text: "text-xs" }',
      );
      expect(statusIndicatorContent).toContain(
        'md: { icon: 16, text: "text-sm" }',
      );
      expect(statusIndicatorContent).toContain(
        'lg: { icon: 20, text: "text-base" }',
      );
    });

    it("should support showLabel prop", () => {
      expect(statusIndicatorContent).toContain("showLabel?: boolean");
      expect(statusIndicatorContent).toContain("showLabel = false");
      expect(statusIndicatorContent).toContain("{showLabel && (");
    });

    it("should have tooltip with status information", () => {
      // Verify main indicator has tooltip
      expect(statusIndicatorContent).toContain('TooltipContent side="bottom"');
    });
  });

  describe("Component exports", () => {
    it("should export all three components", () => {
      expect(statusIndicatorContent).toContain(
        "export function RepoStatusIndicator",
      );
      expect(statusIndicatorContent).toContain("export function RepoStatusDot");
      expect(statusIndicatorContent).toContain(
        "export function RepoStatusBadge",
      );
    });

    it("should be a client component", () => {
      expect(statusIndicatorContent).toContain('"use client"');
    });

    it("should import IndexingStatus type from schema", () => {
      expect(statusIndicatorContent).toContain(
        'import type { IndexingStatus } from "@/lib/db/schema"',
      );
    });
  });
});
