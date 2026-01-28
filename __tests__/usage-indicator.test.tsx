/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";

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
    variant,
    size,
    asChild,
    className,
  }: React.PropsWithChildren<{
    variant?: string;
    size?: string;
    asChild?: boolean;
    className?: string;
  }>) => {
    if (asChild) {
      return <>{children}</>;
    }
    return (
      <button data-variant={variant} data-size={size} className={className}>
        {children}
      </button>
    );
  },
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
  Tooltip: ({ children }: React.PropsWithChildren) => <>{children}</>,
  TooltipTrigger: ({
    children,
    asChild,
  }: React.PropsWithChildren<{ asChild?: boolean }>) => <>{children}</>,
  TooltipContent: ({
    children,
    side,
  }: React.PropsWithChildren<{ side?: string }>) => (
    <div data-side={side}>{children}</div>
  ),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

// Import after mocks
import {
  UsageIndicator,
  UsageLimitOverlay,
} from "@/components/billing/usage-indicator";

describe("UsageIndicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders compact indicator with token count formatted (K notation)", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          tokens: {
            used: 50000,
            limit: 100000,
            percentUsed: 50,
          },
          billingMode: "managed",
          plan: { name: "Pro", tier: "pro" },
        }),
    });

    render(<UsageIndicator />);

    await waitFor(() => {
      expect(screen.getByText("50K/100K")).toBeInTheDocument();
    });
  });

  it("renders compact indicator with M notation for millions", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          tokens: {
            used: 1500000,
            limit: 2000000,
            percentUsed: 75,
          },
          billingMode: "managed",
          plan: { name: "Enterprise", tier: "enterprise" },
        }),
    });

    render(<UsageIndicator />);

    await waitFor(() => {
      expect(screen.getByText("1.5M/2.0M")).toBeInTheDocument();
    });
  });

  it("shows normal state styling when usage < 80%", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          tokens: {
            used: 30000,
            limit: 100000,
            percentUsed: 30,
          },
          billingMode: "managed",
          plan: { name: "Free", tier: "free" },
        }),
    });

    const { container } = render(<UsageIndicator />);

    await waitFor(() => {
      const indicator = container.querySelector(".bg-muted");
      expect(indicator).toBeInTheDocument();
    });
  });

  it("shows warning state (amber) when usage 80-99%", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          tokens: {
            used: 85000,
            limit: 100000,
            percentUsed: 85,
          },
          billingMode: "managed",
          plan: { name: "Pro", tier: "pro" },
        }),
    });

    const { container } = render(<UsageIndicator />);

    await waitFor(() => {
      const indicator = container.querySelector('[class*="amber"]');
      expect(indicator).toBeInTheDocument();
    });

    // Warning message should be in tooltip
    expect(screen.getByText(/Approaching limit/)).toBeInTheDocument();
  });

  it("shows limit state (red) when usage >= 100%", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          tokens: {
            used: 105000,
            limit: 100000,
            percentUsed: 105,
          },
          billingMode: "managed",
          plan: { name: "Pro", tier: "pro" },
        }),
    });

    const { container } = render(<UsageIndicator />);

    await waitFor(() => {
      const indicator = container.querySelector('[class*="red"]');
      expect(indicator).toBeInTheDocument();
    });

    // Limit reached message should be in tooltip
    expect(screen.getByText(/Limit reached/)).toBeInTheDocument();
  });

  it("displays upgrade button for warning states", async () => {
    // Test warning state - upgrade button shown
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          tokens: {
            used: 85000,
            limit: 100000,
            percentUsed: 85,
          },
          billingMode: "managed",
          plan: { name: "Free", tier: "free" },
        }),
    });

    render(<UsageIndicator />);

    await waitFor(() => {
      expect(screen.getByText("Upgrade")).toBeInTheDocument();
    });
  });

  it("returns null for BYOK users", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          tokens: {
            used: 50000,
            limit: 100000,
            percentUsed: 50,
          },
          billingMode: "byok",
          plan: null,
        }),
    });

    const { container } = render(<UsageIndicator />);

    // Wait for loading to complete
    await waitFor(
      () => {
        expect(container.querySelector(".animate-spin")).toBeNull();
      },
      { timeout: 3000 },
    );

    // BYOK users should see empty content (component returns null)
    // Check that no usage indicator content is rendered
    expect(container.querySelector('[class*="rounded-full"]')).toBeNull();
  });

  it("shows tooltip with usage details", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          tokens: {
            used: 50000,
            limit: 100000,
            percentUsed: 50,
          },
          billingMode: "managed",
          plan: { name: "Pro", tier: "pro" },
        }),
    });

    render(<UsageIndicator />);

    await waitFor(() => {
      expect(screen.getByText("Token Usage")).toBeInTheDocument();
      expect(screen.getByText(/50K of 100K tokens used/)).toBeInTheDocument();
      expect(screen.getByText(/Plan: Pro/)).toBeInTheDocument();
    });
  });

  it("shows loading state initially", () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: () =>
                  Promise.resolve({
                    tokens: { used: 50000, limit: 100000, percentUsed: 50 },
                    billingMode: "managed",
                    plan: { name: "Pro", tier: "pro" },
                  }),
              }),
            1000,
          );
        }),
    );

    const { container } = render(<UsageIndicator />);

    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("returns null on error", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
    });

    const { container } = render(<UsageIndicator />);

    await waitFor(
      () => {
        expect(container.querySelector(".animate-spin")).toBeNull();
      },
      { timeout: 3000 },
    );

    // Error state should not show usage indicator
    expect(container.querySelector('[class*="rounded-full"]')).toBeNull();
  });

  it("respects showUpgrade prop", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          tokens: {
            used: 90000,
            limit: 100000,
            percentUsed: 90,
          },
          billingMode: "managed",
          plan: { name: "Free", tier: "free" },
        }),
    });

    render(<UsageIndicator showUpgrade={false} />);

    await waitFor(() => {
      expect(screen.queryByText("Upgrade")).not.toBeInTheDocument();
    });
  });
});

describe("UsageLimitOverlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows overlay when usage >= 100%", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          tokens: {
            used: 105000,
            limit: 100000,
            percentUsed: 105,
          },
          billingMode: "managed",
          plan: { name: "Pro", tier: "pro" },
        }),
    });

    render(<UsageLimitOverlay />);

    await waitFor(() => {
      expect(screen.getByText("Token Limit Reached")).toBeInTheDocument();
    });
  });

  it("hides overlay for BYOK users", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          tokens: {
            used: 150000,
            limit: 100000,
            percentUsed: 150,
          },
          billingMode: "byok",
          plan: null,
        }),
    });

    const { container } = render(<UsageLimitOverlay />);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it("displays clear message about token limit", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          tokens: {
            used: 100000,
            limit: 100000,
            percentUsed: 100,
          },
          billingMode: "managed",
          plan: { name: "Pro", tier: "pro" },
        }),
    });

    render(<UsageLimitOverlay />);

    await waitFor(() => {
      expect(
        screen.getByText(/You've used all 100K tokens for this month/),
      ).toBeInTheDocument();
    });
  });

  it("shows upgrade CTA button", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          tokens: {
            used: 100000,
            limit: 100000,
            percentUsed: 100,
          },
          billingMode: "managed",
          plan: { name: "Pro", tier: "pro" },
        }),
    });

    render(<UsageLimitOverlay />);

    await waitFor(() => {
      expect(screen.getByText("Upgrade Plan")).toBeInTheDocument();
    });

    // Check link destination
    const link = screen.getByText("Upgrade Plan").closest("a");
    expect(link).toHaveAttribute("href", "/settings/subscription");
  });

  it("includes billing cycle reset message", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          tokens: {
            used: 100000,
            limit: 100000,
            percentUsed: 100,
          },
          billingMode: "managed",
          plan: { name: "Pro", tier: "pro" },
        }),
    });

    render(<UsageLimitOverlay />);

    await waitFor(() => {
      expect(
        screen.getByText(/wait until your billing cycle resets/),
      ).toBeInTheDocument();
    });
  });

  it("has proper backdrop blur and opacity", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          tokens: {
            used: 100000,
            limit: 100000,
            percentUsed: 100,
          },
          billingMode: "managed",
          plan: { name: "Pro", tier: "pro" },
        }),
    });

    const { container } = render(<UsageLimitOverlay />);

    await waitFor(() => {
      const overlay = container.firstChild as HTMLElement;
      expect(overlay.className).toContain("backdrop-blur");
      expect(overlay.className).toContain("bg-background/80");
    });
  });

  it("hides overlay when usage is below 100%", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          tokens: {
            used: 90000,
            limit: 100000,
            percentUsed: 90,
          },
          billingMode: "managed",
          plan: { name: "Pro", tier: "pro" },
        }),
    });

    const { container } = render(<UsageLimitOverlay />);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });
});
