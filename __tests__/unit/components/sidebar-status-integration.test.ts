import { describe, it, expect, beforeEach } from "vitest";
import { readSourceFile } from "../../helpers/source-file";

/**
 * Tests for Sidebar status indicator integration
 * These tests verify that sidebar components properly integrate
 * the RepoStatusDot component and include clone/indexing status fields
 */

describe("Sidebar repo status integration", () => {
  describe("Desktop sidebar", () => {
    let desktopSidebarContent: string;

    beforeEach(() => {
      desktopSidebarContent = readSourceFile(
        __dirname,
        "components/sidebar/desktop-sidebar.tsx",
      );
    });

    it("should import RepoStatusDot component", () => {
      expect(desktopSidebarContent).toContain(
        'import { RepoStatusDot } from "@/components/repo-status-indicator"',
      );
    });

    it("should include isCloned in SidebarRepo interface", () => {
      expect(desktopSidebarContent).toContain("interface SidebarRepo");
      expect(desktopSidebarContent).toContain("isCloned: boolean");
    });

    it("should include indexingStatus in SidebarRepo interface", () => {
      expect(desktopSidebarContent).toContain("indexingStatus: IndexingStatus");
    });

    it("should import IndexingStatus type from schema", () => {
      expect(desktopSidebarContent).toContain(
        'import type { IndexingStatus } from "@/lib/db/schema"',
      );
    });

    it("should render RepoStatusDot for each repo", () => {
      expect(desktopSidebarContent).toContain("<RepoStatusDot");
      expect(desktopSidebarContent).toContain("isCloned={repo.isCloned}");
      expect(desktopSidebarContent).toContain(
        "indexingStatus={repo.indexingStatus}",
      );
    });

    it("should render repos in the sidebar navigation", () => {
      expect(desktopSidebarContent).toContain("{repos.map((repo)");
      expect(desktopSidebarContent).toContain("href={`/repos/${repo.id}`}");
    });

    it("should display repo name", () => {
      expect(desktopSidebarContent).toContain("{repo.name}");
    });

    it("should display task count badge when tasks exist", () => {
      expect(desktopSidebarContent).not.toContain("{repo.taskCount > 0 && (");
      expect(desktopSidebarContent).toContain("<RepoStatusDot");
    });
  });

  describe("Mobile sidebar", () => {
    let mobileSidebarContent: string;

    beforeEach(() => {
      mobileSidebarContent = readSourceFile(
        __dirname,
        "components/sidebar/mobile-sidebar.tsx",
      );
    });

    it("should import RepoStatusDot component", () => {
      expect(mobileSidebarContent).toContain(
        'import { RepoStatusDot } from "@/components/repo-status-indicator"',
      );
    });

    it("should include isCloned in SidebarRepo interface", () => {
      expect(mobileSidebarContent).toContain("interface SidebarRepo");
      expect(mobileSidebarContent).toContain("isCloned: boolean");
    });

    it("should include indexingStatus in SidebarRepo interface", () => {
      expect(mobileSidebarContent).toContain("indexingStatus: IndexingStatus");
    });

    it("should import IndexingStatus type from schema", () => {
      expect(mobileSidebarContent).toContain(
        'import type { IndexingStatus } from "@/lib/db/schema"',
      );
    });

    it("should render RepoStatusDot for each repo", () => {
      expect(mobileSidebarContent).toContain("<RepoStatusDot");
      expect(mobileSidebarContent).toContain("isCloned={repo.isCloned}");
      expect(mobileSidebarContent).toContain(
        "indexingStatus={repo.indexingStatus}",
      );
    });

    it("should render repos in the sidebar navigation", () => {
      expect(mobileSidebarContent).toContain("{repos.map((repo)");
      expect(mobileSidebarContent).toContain("href={`/repos/${repo.id}`}");
    });

    it("should display repo name", () => {
      expect(mobileSidebarContent).toContain("{repo.name}");
    });

    it("should display task count badge when tasks exist", () => {
      expect(mobileSidebarContent).not.toContain("{repo.taskCount > 0 && (");
      expect(mobileSidebarContent).toContain("<RepoStatusDot");
    });
  });

  describe("Dashboard layout", () => {
    let layoutContent: string;

    beforeEach(() => {
      layoutContent = readSourceFile(
        __dirname,
        "components/layout/dashboard-layout-client.tsx",
      );
    });

    it("should include isCloned in SidebarRepo interface", () => {
      expect(layoutContent).toContain("interface SidebarRepo");
      expect(layoutContent).toContain("isCloned: boolean");
    });

    it("should include indexingStatus in SidebarRepo interface", () => {
      expect(layoutContent).toContain("indexingStatus: IndexingStatus");
    });

    it("should import IndexingStatus type from schema", () => {
      expect(layoutContent).toContain(
        'import type { IndexingStatus } from "@/lib/db/schema"',
      );
    });

    it("should pass repos prop to Sidebar component", () => {
      expect(layoutContent).toContain("<Sidebar user={user} repos={repos}");
    });

    it("should pass repos prop to MobileSidebar component", () => {
      expect(layoutContent).toContain(
        "<MobileSidebar user={user} repos={repos}",
      );
    });

    it("should include repos in DashboardLayoutClientProps", () => {
      expect(layoutContent).toContain("interface DashboardLayoutClientProps");
      expect(layoutContent).toContain("repos: SidebarRepo[]");
    });
  });

  describe("AddRepoModal clone check integration", () => {
    let addRepoModalContent: string;

    beforeEach(() => {
      addRepoModalContent = readSourceFile(
        __dirname,
        "components/modals/add-repo-modal.tsx",
      );
    });

    it("should call verify-local for each added repo after submit", () => {
      expect(addRepoModalContent).toContain(
        "/api/repos/${repoId}/verify-local",
      );
      expect(addRepoModalContent).toContain(
        "for (const repoId of result.repoIds)",
      );
    });

    it("should show RepoSetupModal when repos need setup", () => {
      expect(addRepoModalContent).toContain("setShowSetupModal(true)");
      expect(addRepoModalContent).toContain("<RepoSetupModal");
      expect(addRepoModalContent).toContain(
        "{showSetupModal && reposNeedingSetup.length > 0 && (",
      );
    });

    it("should pass suggestedPaths to RepoSetupModal", () => {
      expect(addRepoModalContent).toContain(
        "suggestedPaths: verifyData.suggestedPaths",
      );
      expect(addRepoModalContent).toContain("repos={reposNeedingSetup}");
    });

    it("should call onSuccess directly when all repos are verified", () => {
      expect(addRepoModalContent).toContain("if (reposToSetup.length > 0)");
      expect(addRepoModalContent).toContain("} else {");
      expect(addRepoModalContent).toContain("onSuccess();");
    });

    it("should handle verify-local API errors gracefully", () => {
      expect(addRepoModalContent).toContain("} catch {");
      expect(addRepoModalContent).toContain(
        "// If verification fails, still add to setup list",
      );
    });

    it("should import RepoSetupModal", () => {
      expect(addRepoModalContent).toContain(
        'import { RepoSetupModal } from "@/components/modals/repo-setup-modal"',
      );
    });

    it("should have RepoNeedingSetup interface", () => {
      expect(addRepoModalContent).toContain("interface RepoNeedingSetup");
      expect(addRepoModalContent).toContain("suggestedPaths?: string[]");
    });

    it("should handle setup complete callback", () => {
      expect(addRepoModalContent).toContain("handleSetupComplete");
      expect(addRepoModalContent).toContain("onComplete={handleSetupComplete}");
    });
  });

  describe("Consistent interface definitions", () => {
    it("should have matching SidebarRepo interfaces across components", () => {
      const desktopContent = readSourceFile(
        __dirname,
        "components/sidebar/desktop-sidebar.tsx",
      );
      const mobileContent = readSourceFile(
        __dirname,
        "components/sidebar/mobile-sidebar.tsx",
      );
      const layoutContent = readSourceFile(
        __dirname,
        "components/layout/dashboard-layout-client.tsx",
      );

      // All should have the same SidebarRepo interface fields
      const requiredFields = [
        "id: string",
        "name: string",
        "fullName: string",
        "taskCount: number",
        "isCloned: boolean",
        "indexingStatus: IndexingStatus",
      ];

      for (const field of requiredFields) {
        expect(desktopContent).toContain(field);
        expect(mobileContent).toContain(field);
        expect(layoutContent).toContain(field);
      }
    });
  });
});
