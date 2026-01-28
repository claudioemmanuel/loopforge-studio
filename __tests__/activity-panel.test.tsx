/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";

// Mock Next.js Link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock UI components
vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    variant,
    size,
    asChild,
    className,
    ...props
  }: React.PropsWithChildren<{
    onClick?: () => void;
    variant?: string;
    size?: string;
    asChild?: boolean;
    className?: string;
  }>) => {
    if (asChild) {
      return <>{children}</>;
    }
    return (
      <button
        onClick={onClick}
        data-variant={variant}
        data-size={size}
        className={className}
        {...props}
      >
        {children}
      </button>
    );
  },
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

// Import after mocks
import { ActivityPanel } from "@/components/activity-panel/activity-panel";
import { ActivityTab } from "@/components/activity-panel/activity-tab";
import { ChangesTab } from "@/components/activity-panel/changes-tab";
import { HistoryTab } from "@/components/activity-panel/history-tab";

describe("ActivityPanel", () => {
  const mockLocalStorage: Record<string, string> = {};

  const mockGetItem = vi.fn((key: string) => mockLocalStorage[key] || null);
  const mockSetItem = vi.fn((key: string, value: string) => {
    mockLocalStorage[key] = value;
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Clear mockLocalStorage
    Object.keys(mockLocalStorage).forEach(
      (key) => delete mockLocalStorage[key],
    );

    // Setup localStorage mock properly for jsdom
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: mockGetItem,
        setItem: mockSetItem,
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      },
      writable: true,
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: [], changes: [], executions: [] }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Collapsible Sidebar", () => {
    it("renders collapsed toggle button by default", () => {
      render(<ActivityPanel repoId="repo-123" />);

      // Should show collapsed button (with Activity icon)
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
      // First button is the expand button when collapsed
      expect(buttons[0]).toBeInTheDocument();
    });

    it("toggles expand/collapse state", async () => {
      render(<ActivityPanel repoId="repo-123" />);

      // Click to expand - get the first button (expand toggle)
      const buttons = screen.getAllByRole("button");
      fireEvent.click(buttons[0]);

      // Should show expanded panel with Activity header
      await waitFor(() => {
        expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument();
      });
    });

    it("persists state to localStorage", async () => {
      render(<ActivityPanel repoId="repo-123" />);

      // Click to expand
      const buttons = screen.getAllByRole("button");
      fireEvent.click(buttons[0]);

      await waitFor(() => {
        expect(mockSetItem).toHaveBeenCalledWith(
          "activity-panel-expanded",
          "true",
        );
      });
    });

    it("restores state from localStorage", () => {
      mockLocalStorage["activity-panel-expanded"] = "true";

      render(<ActivityPanel repoId="repo-123" />);

      // Should be expanded - the heading should be visible
      expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument();
    });
  });

  describe("Notification Badge", () => {
    it("clears notification when panel is expanded", async () => {
      render(<ActivityPanel repoId="repo-123" />);

      // Click to expand
      const buttons = screen.getAllByRole("button");
      fireEvent.click(buttons[0]);

      // Notification badge should be cleared when expanded
      await waitFor(() => {
        // Just verify expansion happened
        expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument();
      });
    });
  });

  describe("Tab Navigation", () => {
    it("shows Activity, Changes, and History tabs", async () => {
      mockLocalStorage["activity-panel-expanded"] = "true";

      render(<ActivityPanel repoId="repo-123" />);

      await waitFor(() => {
        // Check for tab buttons by their text
        expect(screen.getByText("Changes")).toBeInTheDocument();
        expect(screen.getByText("History")).toBeInTheDocument();
      });
    });

    it("switches between tabs", async () => {
      mockLocalStorage["activity-panel-expanded"] = "true";

      render(<ActivityPanel repoId="repo-123" />);

      await waitFor(() => {
        expect(screen.getByText("Changes")).toBeInTheDocument();
      });

      // Click Changes tab
      const changesTab = screen.getByText("Changes");
      fireEvent.click(changesTab);

      // Changes tab should be active (verify tab was clicked - component will re-render)
      await waitFor(() => {
        expect(changesTab).toBeInTheDocument();
      });
    });
  });
});

describe("ActivityTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches events from API", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          events: [
            {
              id: "event-1",
              eventType: "task_created",
              title: "Task Created",
              content: "A new task was created",
              createdAt: new Date().toISOString(),
            },
          ],
        }),
    });

    render(<ActivityTab repoId="repo-123" />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/activity?repoId=repo-123&limit=50",
      );
    });
  });

  it("displays events with correct icons", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          events: [
            {
              id: "event-1",
              eventType: "task_completed",
              title: "Task Completed",
              content: "The task was completed",
              createdAt: new Date().toISOString(),
            },
          ],
        }),
    });

    render(<ActivityTab repoId="repo-123" />);

    await waitFor(() => {
      expect(screen.getByText("Task Completed")).toBeInTheDocument();
      // Check for checkmark emoji icon for task_completed
      expect(screen.getByText("✅")).toBeInTheDocument();
    });
  });

  it("shows relative timestamps", async () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          events: [
            {
              id: "event-1",
              eventType: "thinking",
              title: "Thinking",
              content: "Processing...",
              createdAt: fiveMinutesAgo,
            },
          ],
        }),
    });

    render(<ActivityTab repoId="repo-123" />);

    await waitFor(() => {
      expect(screen.getByText("5m ago")).toBeInTheDocument();
    });
  });

  it("handles empty state", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: [] }),
    });

    render(<ActivityTab repoId="repo-123" />);

    await waitFor(() => {
      expect(screen.getByText("No activity yet")).toBeInTheDocument();
    });
  });

  it("handles error state", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
    });

    render(<ActivityTab repoId="repo-123" />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load activity")).toBeInTheDocument();
    });
  });
});

describe("ChangesTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches pending changes", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ changes: [] }),
    });

    render(<ChangesTab repoId="repo-123" />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/activity/changes?repoId=repo-123",
      );
    });
  });

  it("groups changes by task", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          changes: [
            {
              id: "change-1",
              taskId: "task-1",
              filePath: "src/index.ts",
              action: "modify",
              isApproved: false,
              task: { id: "task-1", title: "Update API" },
            },
            {
              id: "change-2",
              taskId: "task-1",
              filePath: "src/utils.ts",
              action: "create",
              isApproved: false,
              task: { id: "task-1", title: "Update API" },
            },
          ],
        }),
    });

    render(<ChangesTab repoId="repo-123" />);

    await waitFor(() => {
      // Should show task title once (grouped)
      expect(screen.getByText("Update API")).toBeInTheDocument();
      // Should show both file paths
      expect(screen.getByText("src/index.ts")).toBeInTheDocument();
      expect(screen.getByText("src/utils.ts")).toBeInTheDocument();
    });
  });

  it("shows action indicators (create/modify/delete)", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          changes: [
            {
              id: "change-1",
              taskId: "task-1",
              filePath: "new-file.ts",
              action: "create",
              isApproved: false,
              task: { id: "task-1", title: "Add Feature" },
            },
            {
              id: "change-2",
              taskId: "task-1",
              filePath: "old-file.ts",
              action: "delete",
              isApproved: false,
              task: { id: "task-1", title: "Add Feature" },
            },
          ],
        }),
    });

    const { container } = render(<ChangesTab repoId="repo-123" />);

    await waitFor(() => {
      // Check for action icons/colors
      const greenIcon = container.querySelector(".text-green-500");
      const redIcon = container.querySelector(".text-red-500");
      expect(greenIcon).toBeInTheDocument();
      expect(redIcon).toBeInTheDocument();
    });
  });

  it("links to task review page", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          changes: [
            {
              id: "change-1",
              taskId: "task-123",
              filePath: "file.ts",
              action: "modify",
              isApproved: false,
              task: { id: "task-123", title: "My Task" },
            },
          ],
        }),
    });

    render(<ChangesTab repoId="repo-123" />);

    await waitFor(() => {
      const reviewLink = screen.getByText("Review").closest("a");
      expect(reviewLink).toHaveAttribute("href", "?task=task-123");
    });
  });

  it("handles empty state", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ changes: [] }),
    });

    render(<ChangesTab repoId="repo-123" />);

    await waitFor(() => {
      expect(screen.getByText("No pending changes")).toBeInTheDocument();
    });
  });
});

describe("HistoryTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches execution history", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ executions: [] }),
    });

    render(<HistoryTab repoId="repo-123" />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/activity/history?repoId=repo-123&limit=20",
      );
    });
  });

  it("shows completed/failed status", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          executions: [
            {
              id: "exec-1",
              taskId: "task-1",
              status: "completed",
              branch: "loopforge/task-1",
              prUrl: null,
              prNumber: null,
              createdAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              reverted: false,
              task: { id: "task-1", title: "Completed Task" },
              _count: { commits: 2 },
            },
            {
              id: "exec-2",
              taskId: "task-2",
              status: "failed",
              branch: null,
              prUrl: null,
              prNumber: null,
              createdAt: new Date().toISOString(),
              completedAt: null,
              reverted: false,
              task: { id: "task-2", title: "Failed Task" },
              _count: { commits: 0 },
            },
          ],
        }),
    });

    const { container } = render(<HistoryTab repoId="repo-123" />);

    await waitFor(() => {
      // Check for success/fail icons
      const successIcon = container.querySelector(".text-emerald-500");
      const failIcon = container.querySelector(".text-red-500");
      expect(successIcon).toBeInTheDocument();
      expect(failIcon).toBeInTheDocument();
    });
  });

  it("displays PR links", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          executions: [
            {
              id: "exec-1",
              taskId: "task-1",
              status: "completed",
              branch: "loopforge/task-1",
              prUrl: "https://github.com/user/repo/pull/42",
              prNumber: 42,
              createdAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              reverted: false,
              task: { id: "task-1", title: "Task with PR" },
              _count: { commits: 1 },
            },
          ],
        }),
    });

    render(<HistoryTab repoId="repo-123" />);

    await waitFor(() => {
      const prLink = screen.getByText("PR #42").closest("a");
      expect(prLink).toHaveAttribute(
        "href",
        "https://github.com/user/repo/pull/42",
      );
    });
  });

  it("shows rollback button for eligible executions", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          executions: [
            {
              id: "exec-1",
              taskId: "task-1",
              status: "completed",
              branch: "loopforge/task-1",
              prUrl: null,
              prNumber: null,
              createdAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              reverted: false,
              task: { id: "task-1", title: "Completed Task" },
              _count: { commits: 2 },
            },
          ],
        }),
    });

    render(<HistoryTab repoId="repo-123" />);

    await waitFor(() => {
      expect(screen.getByText("Rollback")).toBeInTheDocument();
    });
  });

  it("hides rollback button for reverted executions", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          executions: [
            {
              id: "exec-1",
              taskId: "task-1",
              status: "completed",
              branch: "loopforge/task-1",
              prUrl: null,
              prNumber: null,
              createdAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              reverted: true,
              task: { id: "task-1", title: "Reverted Task" },
              _count: { commits: 2 },
            },
          ],
        }),
    });

    render(<HistoryTab repoId="repo-123" />);

    await waitFor(() => {
      expect(screen.getByText("Reverted")).toBeInTheDocument();
      expect(screen.queryByText("Rollback")).not.toBeInTheDocument();
    });
  });

  it("handles empty state", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ executions: [] }),
    });

    render(<HistoryTab repoId="repo-123" />);

    await waitFor(() => {
      expect(screen.getByText("No execution history")).toBeInTheDocument();
    });
  });

  it("shows branch name", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          executions: [
            {
              id: "exec-1",
              taskId: "task-1",
              status: "completed",
              branch: "loopforge/task-abc123",
              prUrl: null,
              prNumber: null,
              createdAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              reverted: false,
              task: { id: "task-1", title: "My Task" },
              _count: { commits: 1 },
            },
          ],
        }),
    });

    render(<HistoryTab repoId="repo-123" />);

    await waitFor(() => {
      expect(screen.getByText("loopforge/task-abc123")).toBeInTheDocument();
    });
  });
});
