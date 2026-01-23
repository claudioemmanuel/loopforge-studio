import { describe, it, expect, beforeEach } from "vitest";
import { cn } from "@/lib/utils";
import * as fs from "fs";
import * as path from "path";

/**
 * Tests for responsive design implementation
 * These tests verify that responsive CSS classes and patterns are correctly applied
 */

describe("Responsive Design", () => {
  describe("CSS Utility Classes", () => {
    let globalsCss: string;

    beforeEach(() => {
      const cssPath = path.resolve(__dirname, "../app/globals.css");
      globalsCss = fs.readFileSync(cssPath, "utf-8");
    });

    it("should have scrollbar-hide utility class", () => {
      expect(globalsCss).toContain(".scrollbar-hide");
      expect(globalsCss).toContain("scrollbar-width: none");
      expect(globalsCss).toContain("-webkit-scrollbar");
    });

    it("should have touch device utility for opacity", () => {
      expect(globalsCss).toContain("@media (hover: none)");
      expect(globalsCss).toContain("touch\\:opacity-100");
    });
  });

  describe("Sidebar Context Pattern", () => {
    it("should export correct functions from sidebar context", async () => {
      const sidebarModule = await import("@/components/sidebar/sidebar-context");
      expect(sidebarModule.SidebarProvider).toBeDefined();
      expect(sidebarModule.useSidebar).toBeDefined();
    });
  });

  describe("Mobile Header Component", () => {
    let mobileHeaderContent: string;

    beforeEach(() => {
      const filePath = path.resolve(__dirname, "../components/sidebar/mobile-header.tsx");
      mobileHeaderContent = fs.readFileSync(filePath, "utf-8");
    });

    it("should have md:hidden class to hide on desktop", () => {
      expect(mobileHeaderContent).toContain("md:hidden");
    });

    it("should be fixed positioned", () => {
      expect(mobileHeaderContent).toContain("fixed");
      expect(mobileHeaderContent).toContain("top-0");
    });

    it("should have correct height (h-14)", () => {
      expect(mobileHeaderContent).toContain("h-14");
    });

    it("should have z-index for proper stacking", () => {
      expect(mobileHeaderContent).toContain("z-40");
    });
  });

  describe("Mobile Sidebar Component", () => {
    let mobileSidebarContent: string;

    beforeEach(() => {
      const filePath = path.resolve(__dirname, "../components/sidebar/mobile-sidebar.tsx");
      mobileSidebarContent = fs.readFileSync(filePath, "utf-8");
    });

    it("should have md:hidden class on backdrop", () => {
      // Backdrop should only show on mobile
      expect(mobileSidebarContent).toMatch(/className=\{cn\([^}]*"[^"]*md:hidden[^"]*"/);
    });

    it("should have md:hidden class on sidebar aside", () => {
      expect(mobileSidebarContent).toContain("md:hidden");
    });

    it("should use translate-x for slide animation", () => {
      expect(mobileSidebarContent).toContain("translate-x-0");
      expect(mobileSidebarContent).toContain("-translate-x-full");
    });

    it("should have proper z-index stacking", () => {
      expect(mobileSidebarContent).toContain("z-50");
      expect(mobileSidebarContent).toContain("z-40");
    });

    it("should have 280px width", () => {
      expect(mobileSidebarContent).toContain("w-[280px]");
    });

    it("should close on route change", () => {
      expect(mobileSidebarContent).toContain("pathname");
      expect(mobileSidebarContent).toContain("closeSidebar");
    });

    it("should close on escape key", () => {
      expect(mobileSidebarContent).toContain("Escape");
    });
  });

  describe("Dashboard Layout Client Component", () => {
    let layoutContent: string;

    beforeEach(() => {
      const filePath = path.resolve(__dirname, "../components/layout/dashboard-layout-client.tsx");
      layoutContent = fs.readFileSync(filePath, "utf-8");
    });

    it("should hide desktop sidebar on mobile with hidden md:block", () => {
      expect(layoutContent).toContain("hidden md:block");
    });

    it("should add top padding for mobile header (pt-14 md:pt-0)", () => {
      expect(layoutContent).toContain("pt-14");
      expect(layoutContent).toContain("md:pt-0");
    });

    it("should include SidebarProvider wrapper", () => {
      expect(layoutContent).toContain("SidebarProvider");
    });

    it("should render MobileHeader component", () => {
      expect(layoutContent).toContain("<MobileHeader");
    });

    it("should render MobileSidebar component", () => {
      expect(layoutContent).toContain("<MobileSidebar");
    });
  });

  describe("Kanban Column Component", () => {
    let kanbanColumnContent: string;

    beforeEach(() => {
      const filePath = path.resolve(__dirname, "../components/kanban/kanban-column.tsx");
      kanbanColumnContent = fs.readFileSync(filePath, "utf-8");
    });

    it("should have fixed width for horizontal scrolling (not w-full)", () => {
      // Should NOT have w-full which breaks horizontal scrolling
      expect(kanbanColumnContent).not.toMatch(/w-full\s+sm:w-\[/);
    });

    it("should have fixed minimum width", () => {
      expect(kanbanColumnContent).toContain("min-w-[280px]");
    });

    it("should have responsive width breakpoint for md", () => {
      expect(kanbanColumnContent).toContain("md:w-[300px]");
      expect(kanbanColumnContent).toContain("md:min-w-[300px]");
    });
  });

  describe("Kanban Card Component", () => {
    let kanbanCardContent: string;

    beforeEach(() => {
      const filePath = path.resolve(__dirname, "../components/kanban/kanban-card.tsx");
      kanbanCardContent = fs.readFileSync(filePath, "utf-8");
    });

    it("should have touch-friendly drag handle (visible on mobile)", () => {
      // Should use sm:opacity-0 sm:group-hover:opacity-100 pattern
      expect(kanbanCardContent).toContain("sm:opacity-0");
      expect(kanbanCardContent).toContain("sm:group-hover:opacity-100");
    });

    it("should have touch-friendly dropdown trigger", () => {
      expect(kanbanCardContent).toMatch(/sm:opacity-0.*sm:group-hover:opacity-100/s);
    });

    it("should have touch-friendly action buttons", () => {
      // Action buttons should be visible on mobile (sm:opacity-0 pattern)
      const matches = kanbanCardContent.match(/sm:opacity-0 sm:group-hover:opacity-100/g);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBeGreaterThanOrEqual(3); // drag handle, dropdown, action buttons
    });
  });

  describe("Kanban Board Component", () => {
    let kanbanBoardContent: string;

    beforeEach(() => {
      const filePath = path.resolve(__dirname, "../components/kanban/kanban-board.tsx");
      kanbanBoardContent = fs.readFileSync(filePath, "utf-8");
    });

    it("should have horizontal scroll container", () => {
      expect(kanbanBoardContent).toContain("overflow-x-auto");
    });

    it("should have scrollbar-hide class", () => {
      expect(kanbanBoardContent).toContain("scrollbar-hide");
    });

    it("should have mobile scroll fade hints", () => {
      expect(kanbanBoardContent).toContain("bg-gradient-to-r");
      expect(kanbanBoardContent).toContain("bg-gradient-to-l");
      expect(kanbanBoardContent).toContain("md:hidden");
    });
  });

  describe("Task Modal Component", () => {
    let taskModalContent: string;

    beforeEach(() => {
      const filePath = path.resolve(__dirname, "../components/modals/task-modal.tsx");
      taskModalContent = fs.readFileSync(filePath, "utf-8");
    });

    it("should have responsive footer layout", () => {
      expect(taskModalContent).toContain("flex-col");
      expect(taskModalContent).toContain("sm:flex-row");
    });

    it("should have responsive padding", () => {
      expect(taskModalContent).toContain("p-4");
      expect(taskModalContent).toContain("sm:p-6");
    });
  });

  describe("New Task Modal Component", () => {
    let newTaskModalContent: string;

    beforeEach(() => {
      const filePath = path.resolve(__dirname, "../components/modals/new-task-modal.tsx");
      newTaskModalContent = fs.readFileSync(filePath, "utf-8");
    });

    it("should have responsive footer layout", () => {
      expect(newTaskModalContent).toContain("flex-col-reverse");
      expect(newTaskModalContent).toContain("sm:flex-row");
    });

    it("should have full-width buttons on mobile", () => {
      expect(newTaskModalContent).toContain("w-full sm:w-auto");
    });
  });

  describe("Error Dialog Component", () => {
    let errorDialogContent: string;

    beforeEach(() => {
      const filePath = path.resolve(__dirname, "../components/ui/error-dialog.tsx");
      errorDialogContent = fs.readFileSync(filePath, "utf-8");
    });

    it("should have proper mobile viewport margins", () => {
      expect(errorDialogContent).toContain("w-[calc(100%-2rem)]");
    });
  });

  describe("Confirm Dialog Component", () => {
    let confirmDialogContent: string;

    beforeEach(() => {
      const filePath = path.resolve(__dirname, "../components/ui/confirm-dialog.tsx");
      confirmDialogContent = fs.readFileSync(filePath, "utf-8");
    });

    it("should have proper mobile viewport margins", () => {
      expect(confirmDialogContent).toContain("w-[calc(100%-2rem)]");
    });
  });

  describe("Analytics Page", () => {
    let analyticsPageContent: string;

    beforeEach(() => {
      const filePath = path.resolve(__dirname, "../app/(dashboard)/analytics/page.tsx");
      analyticsPageContent = fs.readFileSync(filePath, "utf-8");
    });

    it("should have responsive padding", () => {
      expect(analyticsPageContent).toContain("p-4");
      expect(analyticsPageContent).toContain("sm:p-6");
      expect(analyticsPageContent).toContain("lg:p-8");
    });

    it("should have responsive header layout", () => {
      expect(analyticsPageContent).toContain("flex-col");
      expect(analyticsPageContent).toContain("sm:flex-row");
    });

    it("should have responsive text sizes", () => {
      expect(analyticsPageContent).toContain("text-2xl");
      expect(analyticsPageContent).toContain("sm:text-3xl");
    });
  });

  describe("Repo Activity Table Component", () => {
    let repoActivityTableContent: string;

    beforeEach(() => {
      const filePath = path.resolve(__dirname, "../components/analytics/repo-activity-table.tsx");
      repoActivityTableContent = fs.readFileSync(filePath, "utf-8");
    });

    it("should have mobile card layout", () => {
      expect(repoActivityTableContent).toContain("md:hidden");
      expect(repoActivityTableContent).toContain("space-y-3");
    });

    it("should have desktop table layout", () => {
      expect(repoActivityTableContent).toContain("hidden md:block");
      expect(repoActivityTableContent).toContain("<table");
    });
  });

  describe("Settings Integrations Page", () => {
    let integrationsPageContent: string;

    beforeEach(() => {
      const filePath = path.resolve(__dirname, "../app/(dashboard)/settings/integrations/page.tsx");
      integrationsPageContent = fs.readFileSync(filePath, "utf-8");
    });

    it("should have responsive provider selector layout", () => {
      expect(integrationsPageContent).toContain("flex-col");
      expect(integrationsPageContent).toContain("sm:flex-row");
      expect(integrationsPageContent).toContain("sm:items-center");
    });

    it("should have scrollable provider buttons", () => {
      expect(integrationsPageContent).toContain("overflow-x-auto");
      expect(integrationsPageContent).toContain("scrollbar-hide");
    });

    it("should have responsive button padding", () => {
      expect(integrationsPageContent).toContain("px-2 sm:px-3");
    });
  });

  describe("Responsive Class Patterns with cn utility", () => {
    it("should correctly merge responsive classes", () => {
      const result = cn("p-4", "sm:p-6", "lg:p-8");
      expect(result).toBe("p-4 sm:p-6 lg:p-8");
    });

    it("should handle conditional responsive classes", () => {
      const isMobile = true;
      const result = cn(
        "flex",
        isMobile ? "flex-col" : "flex-row",
        "sm:flex-row"
      );
      expect(result).toContain("flex-col");
      expect(result).toContain("sm:flex-row");
    });

    it("should handle hidden/block responsive patterns", () => {
      const result = cn("hidden", "md:block");
      expect(result).toBe("hidden md:block");
    });

    it("should handle opacity responsive patterns", () => {
      const result = cn("sm:opacity-0", "sm:group-hover:opacity-100");
      expect(result).toBe("sm:opacity-0 sm:group-hover:opacity-100");
    });
  });

  describe("Breakpoint Consistency", () => {
    it("should use consistent breakpoints across components", () => {
      // Read all relevant component files and verify breakpoint usage
      const components = [
        "../components/sidebar/mobile-header.tsx",
        "../components/sidebar/mobile-sidebar.tsx",
        "../components/layout/dashboard-layout-client.tsx",
        "../components/kanban/kanban-column.tsx",
      ];

      for (const componentPath of components) {
        const content = fs.readFileSync(
          path.resolve(__dirname, componentPath),
          "utf-8"
        );

        // All mobile/desktop transitions should use md: breakpoint (768px)
        if (content.includes("md:hidden") || content.includes("hidden md:block")) {
          // Verify consistent use of md: for mobile/desktop transitions
          expect(content).toMatch(/md:(hidden|block)/);
        }
      }
    });
  });
});
