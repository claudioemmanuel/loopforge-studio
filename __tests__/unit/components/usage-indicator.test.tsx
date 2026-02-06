/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { UsageDashboard } from "@/components/billing/usage-dashboard";

describe("UsageDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders token/task/repository usage after load", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        currentPeriod: {
          start: "2026-02-01T00:00:00.000Z",
          end: "2026-02-28T23:59:59.999Z",
        },
        tokens: { used: 1500, limit: 10000, percentUsed: 15 },
        tasks: { created: 4, limit: 100, percentUsed: 4 },
        repos: { count: 2, limit: 10, percentUsed: 20 },
        estimatedCost: { cents: 250, formatted: "$2.50" },
        billingMode: "managed",
        plan: { name: "Pro", tier: "pro" },
      }),
    } as Response);

    render(<UsageDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Usage")).toBeInTheDocument();
    });

    expect(screen.getByText(/1.5K/i)).toBeInTheDocument();
    expect(screen.getByText(/4 \/ 100/)).toBeInTheDocument();
    expect(screen.getByText(/2 \/ 10/)).toBeInTheDocument();
    expect(screen.getByText("$2.50")).toBeInTheDocument();
  });

  it("renders error fallback when request fails", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => ({}),
    } as Response);

    render(<UsageDashboard />);

    await waitFor(() => {
      expect(
        screen.getByText(/unable to load usage data|failed to fetch usage/i),
      ).toBeInTheDocument();
    });
  });
});
