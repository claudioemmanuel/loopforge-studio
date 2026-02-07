/**
 * @vitest-environment jsdom
 */
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { StuckTasksWidget } from "@/components/dashboard/stuck-tasks-widget";

vi.mock("next/link", () => ({
  default: ({ children, href }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href}>{children}</a>
  ),
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("StuckTasksWidget", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stays hidden while background check runs and no tasks need attention", async () => {
    const deferred = createDeferred<Response>();
    global.fetch = vi
      .fn()
      .mockReturnValueOnce(deferred.promise) as typeof fetch;

    render(<StuckTasksWidget />);

    expect(
      screen.queryByText("Tasks Needing Attention"),
    ).not.toBeInTheDocument();

    deferred.resolve(
      new Response(
        JSON.stringify({
          stuckTasks: [],
          recoveringTasks: [],
          totalCount: 0,
        }),
        { status: 200 },
      ),
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/dashboard/stuck-tasks");
    });

    await waitFor(() => {
      expect(
        screen.queryByText("Tasks Needing Attention"),
      ).not.toBeInTheDocument();
    });
  });

  it("renders warning card when API reports tasks needing attention", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          stuckTasks: [
            {
              id: "task-1",
              title: "Fix build pipeline",
              status: "stuck",
              processingPhase: null,
              repoId: "repo-1",
              repoName: "core-api",
              isRecovering: false,
              recoveryAttemptCount: 0,
              updatedAt: new Date().toISOString(),
            },
          ],
          recoveringTasks: [],
          totalCount: 1,
        }),
        { status: 200 },
      ),
    ) as typeof fetch;

    render(<StuckTasksWidget />);

    await waitFor(() => {
      expect(screen.getByText("Tasks Needing Attention")).toBeInTheDocument();
    });
    expect(screen.getByText("Fix build pipeline")).toBeInTheDocument();
  });
});
