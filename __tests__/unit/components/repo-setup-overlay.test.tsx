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
import { RepoSetupOverlay } from "@/components/repo-setup/repo-setup-overlay";

describe("RepoSetupOverlay", () => {
  const defaultProps = {
    repoId: "repo-123",
    repoName: "test-repo",
    isCloned: false,
    onCloneComplete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders semi-transparent overlay with backdrop blur", () => {
    const { container } = render(<RepoSetupOverlay {...defaultProps} />);

    const overlay = container.firstChild as HTMLElement;
    expect(overlay).toBeInTheDocument();
    expect(overlay.className).toContain("backdrop-blur");
    expect(overlay.className).toContain("bg-background/60");
  });

  it("shows centered CTA with correct messaging", () => {
    render(<RepoSetupOverlay {...defaultProps} />);

    expect(screen.getByText("Set Up Repository")).toBeInTheDocument();
    expect(
      screen.getByText(/Clone this repository to start executing AI tasks/),
    ).toBeInTheDocument();
    expect(screen.getByText("Clone Repository")).toBeInTheDocument();
  });

  it("displays loading spinner during cloning", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: () => Promise.resolve({}),
              }),
            500,
          );
        }),
    );

    render(<RepoSetupOverlay {...defaultProps} />);

    const cloneButton = screen.getByText("Clone Repository");
    await act(async () => {
      fireEvent.click(cloneButton);
    });

    await waitFor(() => {
      expect(screen.getByText("Cloning...")).toBeInTheDocument();
      expect(screen.getByText(/Cloning test-repo/)).toBeInTheDocument();
    });
  });

  it("shows error state with Try Again button", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Clone failed" }),
    });

    render(<RepoSetupOverlay {...defaultProps} />);

    const cloneButton = screen.getByText("Clone Repository");
    await act(async () => {
      fireEvent.click(cloneButton);
    });

    await waitFor(() => {
      expect(screen.getByText("Clone Failed")).toBeInTheDocument();
    });

    expect(screen.getByText("Clone failed")).toBeInTheDocument();
    expect(screen.getByText("Try Again")).toBeInTheDocument();
  });

  it("hides overlay when repo is already cloned", () => {
    const { container } = render(
      <RepoSetupOverlay {...defaultProps} isCloned={true} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("calls onCloneComplete on successful clone", async () => {
    const onCloneComplete = vi.fn();

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    render(
      <RepoSetupOverlay {...defaultProps} onCloneComplete={onCloneComplete} />,
    );

    const cloneButton = screen.getByText("Clone Repository");
    await act(async () => {
      fireEvent.click(cloneButton);
    });

    await waitFor(() => {
      expect(onCloneComplete).toHaveBeenCalled();
    });
  });

  it("shows helper text about task creation without cloning", () => {
    render(<RepoSetupOverlay {...defaultProps} />);

    expect(
      screen.getByText(/Tasks can be created and organized without cloning/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Execution requires the repository to be cloned/),
    ).toBeInTheDocument();
  });

  it("allows retry after error", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "First failure" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

    const onCloneComplete = vi.fn();
    render(
      <RepoSetupOverlay {...defaultProps} onCloneComplete={onCloneComplete} />,
    );

    // First click - fails
    const cloneButton = screen.getByText("Clone Repository");
    await act(async () => {
      fireEvent.click(cloneButton);
    });

    await waitFor(() => {
      expect(screen.getByText("Clone Failed")).toBeInTheDocument();
    });

    // Second click - succeeds
    const retryButton = screen.getByText("Try Again");
    await act(async () => {
      fireEvent.click(retryButton);
    });

    await waitFor(() => {
      expect(onCloneComplete).toHaveBeenCalled();
    });
  });

  it("shows destructive variant for error retry button", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Error" }),
    });

    render(<RepoSetupOverlay {...defaultProps} />);

    const cloneButton = screen.getByText("Clone Repository");
    await act(async () => {
      fireEvent.click(cloneButton);
    });

    await waitFor(() => {
      const retryButton = screen.getByText("Try Again");
      expect(retryButton.closest("button")).toHaveAttribute(
        "data-variant",
        "destructive",
      );
    });
  });

  it("handles generic fetch error", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Network error"),
    );

    render(<RepoSetupOverlay {...defaultProps} />);

    const cloneButton = screen.getByText("Clone Repository");
    await act(async () => {
      fireEvent.click(cloneButton);
    });

    await waitFor(() => {
      expect(screen.getByText("Clone Failed")).toBeInTheDocument();
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("disables clone button while cloning", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: () => Promise.resolve({}),
              }),
            1000,
          );
        }),
    );

    render(<RepoSetupOverlay {...defaultProps} />);

    const cloneButton = screen.getByText("Clone Repository");
    await act(async () => {
      fireEvent.click(cloneButton);
    });

    await waitFor(() => {
      const cloningButton = screen.getByText("Cloning...");
      expect(cloningButton.closest("button")).toBeDisabled();
    });
  });
});
