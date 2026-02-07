import { beforeEach, describe, expect, it, vi } from "vitest";

const recordHeartbeat = vi.fn().mockResolvedValue(undefined);
const getLatestHeartbeat = vi.fn().mockResolvedValue(null);
const unauthorized = vi.fn((message: string) => ({
  code: "unauthorized",
  message,
}));
const serverError = vi.fn((error: unknown) => ({ code: "server", error }));
const handleError = vi.fn((payload: unknown) =>
  Response.json({ error: payload }, { status: 401 }),
);

vi.mock("@/lib/contexts/execution/api", () => ({
  getWorkerMonitoringService: vi.fn(() => ({
    recordHeartbeat,
    getLatestHeartbeat,
  })),
}));

vi.mock("@/lib/errors", () => ({
  handleError,
  Errors: {
    unauthorized,
    serverError,
  },
}));

describe("Workers heartbeat route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WORKER_SECRET = "test-secret";
  });

  it("records a heartbeat when worker token is valid", async () => {
    const { POST } = await import("@/app/api/workers/heartbeat/route");

    const request = new Request("http://localhost/api/workers/heartbeat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-worker-token": "test-secret",
      },
      body: JSON.stringify({
        workerId: "worker-alpha",
        version: "9.9.9",
      }),
    });

    const response = await POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(recordHeartbeat).toHaveBeenCalledWith({
      workerId: "worker-alpha",
      metadata: expect.objectContaining({
        version: "9.9.9",
      }),
    });
    expect(handleError).not.toHaveBeenCalled();
  });

  it("rejects request when worker token is invalid", async () => {
    const { POST } = await import("@/app/api/workers/heartbeat/route");

    const request = new Request("http://localhost/api/workers/heartbeat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-worker-token": "wrong-secret",
      },
      body: JSON.stringify({ workerId: "worker-alpha" }),
    });

    const response = await POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(unauthorized).toHaveBeenCalledWith("Invalid worker token");
    expect(body.error.code).toBe("unauthorized");
    expect(recordHeartbeat).not.toHaveBeenCalled();
  });

  it("returns latest heartbeat via GET", async () => {
    const now = new Date("2026-02-07T12:00:00.000Z");
    getLatestHeartbeat.mockResolvedValueOnce({
      timestamp: now,
      workerId: "worker-beta",
      metadata: { version: "1.0.0" },
    });

    const { GET } = await import("@/app/api/workers/heartbeat/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      heartbeat: now.toISOString(),
      workerId: "worker-beta",
      metadata: { version: "1.0.0" },
    });
  });
});
