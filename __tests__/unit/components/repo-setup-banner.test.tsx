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

// Mock UI components
vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
    size,
    className,
    ...props
  }: React.PropsWithChildren<{
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
    size?: string;
    className?: string;
  }>) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      className={className}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

// Import after mocks
import { RepoSetupBanner } from "@/components/repo-setup/repo-setup-banner";

describe("RepoSetupBanner", () => {
  const defaultProps = {
    repoId: "repo-123",
    repoName: "test-repo",
    isCloned: false,
    onCloneComplete: vi.fn(),
  };

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

    // Mock fetch
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders amber alert banner when repo not cloned", () => {
    render(<RepoSetupBanner {...defaultProps} />);

    expect(screen.getByText("Repository Not Cloned")).toBeInTheDocument();
    expect(
      screen.getByText("Clone this repository to enable AI task execution"),
    ).toBeInTheDocument();
    expect(screen.getByText("Clone Now")).toBeInTheDocument();
  });

  it("shows clone progress indicator during cloning", async () => {
    // Mock a pending fetch that resolves quickly
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: () => Promise.resolve({}),
              }),
            50, // Short delay
          );
        }),
    );

    render(<RepoSetupBanner {...defaultProps} />);

    const cloneButton = screen.getByText("Clone Now");
    fireEvent.click(cloneButton);

    // Should show loading state immediately
    await waitFor(() => {
      expect(screen.getByText("Cloning...")).toBeInTheDocument();
    });
  });

  it("saves dismissal state to localStorage when clicking X", async () => {
    render(<RepoSetupBanner {...defaultProps} />);

    // Find and click the dismiss button
    const buttons = screen.getAllByRole("button");
    const xButton = buttons.find((btn) => !btn.textContent?.includes("Clone"));

    if (xButton) {
      fireEvent.click(xButton);
    }

    await waitFor(() => {
      expect(mockSetItem).toHaveBeenCalledWith(
        "repo-setup-dismissed-repo-123",
        "true",
      );
    });
  });

  it("restores dismissal state from localStorage on mount", () => {
    mockLocalStorage["repo-setup-dismissed-repo-123"] = "true";

    const { container } = render(<RepoSetupBanner {...defaultProps} />);

    // Banner should not render when dismissed
    expect(container.firstChild).toBeNull();
  });

  it("shows error state with retry button", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Network error" }),
    });

    render(<RepoSetupBanner {...defaultProps} />);

    const cloneButton = screen.getByText("Clone Now");
    await act(async () => {
      fireEvent.click(cloneButton);
    });

    await waitFor(() => {
      expect(screen.getByText("Clone Failed")).toBeInTheDocument();
    });

    expect(screen.getByText("Network error")).toBeInTheDocument();
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("calls onCloneComplete callback on success", async () => {
    const onCloneComplete = vi.fn();

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    render(
      <RepoSetupBanner {...defaultProps} onCloneComplete={onCloneComplete} />,
    );

    const cloneButton = screen.getByText("Clone Now");
    await act(async () => {
      fireEvent.click(cloneButton);
    });

    await waitFor(() => {
      expect(onCloneComplete).toHaveBeenCalled();
    });
  });

  it("does not render when isCloned is true", () => {
    const { container } = render(
      <RepoSetupBanner {...defaultProps} isCloned={true} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("handles fetch error gracefully", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Failed to fetch"),
    );

    render(<RepoSetupBanner {...defaultProps} />);

    const cloneButton = screen.getByText("Clone Now");
    await act(async () => {
      fireEvent.click(cloneButton);
    });

    await waitFor(() => {
      expect(screen.getByText("Clone Failed")).toBeInTheDocument();
    });

    expect(screen.getByText("Failed to fetch")).toBeInTheDocument();
  });

  it("shows success state after successful clone", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    render(<RepoSetupBanner {...defaultProps} />);

    const cloneButton = screen.getByText("Clone Now");
    await act(async () => {
      fireEvent.click(cloneButton);
    });

    await waitFor(() => {
      expect(screen.getByText("Repository Cloned")).toBeInTheDocument();
    });
  });
});
