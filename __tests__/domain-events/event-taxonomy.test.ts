import { describe, expect, it } from "vitest";
import {
  toCanonicalEventType,
  getCompatibleEventTypes,
} from "@/lib/contexts/domain-events/event-taxonomy";

describe("event taxonomy", () => {
  it("normalizes legacy execution completion keys to canonical format", () => {
    expect(toCanonicalEventType("ExecutionCompleted")).toBe(
      "Execution.Completed",
    );
    expect(toCanonicalEventType("Execution.ExecutionCompleted")).toBe(
      "Execution.Completed",
    );
  });

  it("returns compatibility aliases for canonical keys", () => {
    const aliases = getCompatibleEventTypes("Execution.Completed");

    expect(aliases).toContain("Execution.Completed");
    expect(aliases).toContain("ExecutionCompleted");
    expect(aliases).toContain("Execution.ExecutionCompleted");
  });

  it("keeps unknown keys unchanged", () => {
    expect(toCanonicalEventType("UnknownType")).toBe("UnknownType");
    expect(getCompatibleEventTypes("UnknownType")).toEqual(["UnknownType"]);
  });
});
