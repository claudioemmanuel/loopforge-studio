import { describe, expect, it } from "vitest";
import {
  activityEvents,
  executions,
  repos,
  tasks,
  users,
} from "@/lib/db/schema";
import {
  aiProviderEnum,
  executionStatusEnum,
  taskStatusEnum,
} from "@/lib/db/schema/enums";

describe("db schema exports", () => {
  it("exposes core tables", () => {
    expect(users).toBeTruthy();
    expect(repos).toBeTruthy();
    expect(tasks).toBeTruthy();
    expect(executions).toBeTruthy();
    expect(activityEvents).toBeTruthy();
  });

  it("exposes key enums used by application services", () => {
    expect(taskStatusEnum.enumValues).toContain("executing");
    expect(executionStatusEnum.enumValues).toContain("queued");
    expect(aiProviderEnum.enumValues).toEqual(
      expect.arrayContaining(["anthropic", "openai", "gemini"]),
    );
  });
});
