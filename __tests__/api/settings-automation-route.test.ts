import { beforeEach, describe, expect, it, vi } from "vitest";

const updateUserFields = vi.fn();
const validateCloneDirectory = vi.fn();
const expandPath = vi.fn();

vi.mock("@/lib/api", () => ({
  withAuth: (handler: (...args: unknown[]) => Promise<Response>) => handler,
}));

vi.mock("@/lib/contexts/iam/api", () => ({
  getUserService: vi.fn(() => ({
    updateUserFields,
  })),
}));

vi.mock("@/lib/utils/path-utils", () => ({
  validateCloneDirectory,
  expandPath,
}));

describe("Settings automation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateCloneDirectory.mockResolvedValue({
      valid: true,
      exists: true,
      writable: true,
    });
    expandPath.mockImplementation((value: string) => `/expanded/${value}`);
  });

  it("returns unified automation settings payload", async () => {
    const { GET } = await import("@/app/api/settings/automation/route");

    const response = await GET(
      new Request("http://localhost/api/settings/automation"),
      {
        user: {
          defaultCloneDirectory: "~/Documents/GitHub",
          defaultTestCommand: "npm run test",
          defaultTestTimeout: 300000,
          defaultTestGatePolicy: "warn",
          defaultBranchPrefix: "loopforge/",
          requirePlanApproval: true,
        },
      } as never,
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.defaultCloneDirectory).toBe("~/Documents/GitHub");
    expect(body.expandedCloneDirectory).toBe("/expanded/~/Documents/GitHub");
    expect(body.defaultBranchPrefix).toBe("loopforge/");
    expect(body.requirePlanApproval).toBe(true);
  });

  it("normalizes default branch prefix and persists automation fields", async () => {
    const { PUT } = await import("@/app/api/settings/automation/route");

    const response = await PUT(
      new Request("http://localhost/api/settings/automation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultCloneDirectory: "~/Projects",
          defaultBranchPrefix: "  loopforge  ",
          requirePlanApproval: true,
        }),
      }),
      {
        user: { id: "user-1" },
      } as never,
    );

    expect(response.status).toBe(200);
    expect(updateUserFields).toHaveBeenCalledWith("user-1", {
      defaultCloneDirectory: "~/Projects",
      defaultBranchPrefix: "loopforge/",
      requirePlanApproval: true,
    });
  });
});
