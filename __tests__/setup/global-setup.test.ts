import { describe, expect, it } from "vitest";
import { resolveTestDatabaseConfig } from "@/__tests__/setup/global-setup";

describe("resolveTestDatabaseConfig", () => {
  it("uses postgres admin URL when no env vars are set", () => {
    const config = resolveTestDatabaseConfig({});

    expect(config.testDatabaseUrl).toBe(
      "postgresql://postgres:postgres@localhost:5432/loopforge_test",
    );
    expect(config.adminUrl).toBe(
      "postgresql://postgres:postgres@localhost:5432/postgres",
    );
    expect(config.testDbName).toBe("loopforge_test");
  });
});
