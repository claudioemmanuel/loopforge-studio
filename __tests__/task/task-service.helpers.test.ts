import { describe, expect, it } from "vitest";
import { getWorkerStatusesForFilter } from "@/lib/contexts/task/application/task-service";

describe("getWorkerStatusesForFilter", () => {
  it("returns all active worker statuses when filter is all", () => {
    expect(getWorkerStatusesForFilter("all")).toEqual([
      "brainstorming",
      "planning",
      "ready",
      "executing",
      "stuck",
    ]);
  });

  it("returns only the requested status when filter is specific", () => {
    expect(getWorkerStatusesForFilter("planning")).toEqual(["planning"]);
  });

  it("falls back to all statuses for unknown filters", () => {
    expect(getWorkerStatusesForFilter("unexpected")).toEqual([
      "brainstorming",
      "planning",
      "ready",
      "executing",
      "stuck",
    ]);
  });
});
