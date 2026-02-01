import { describe, it, expect } from "vitest";
import { connectionOptions } from "@/lib/queue/connection";

describe("Queue Module", () => {
  describe("Connection Options", () => {
    it("should have valid connection options", () => {
      expect(connectionOptions).toBeDefined();
      expect(connectionOptions.host).toBeDefined();
      expect(connectionOptions.port).toBeDefined();
    });

    it("should default to localhost:6379", () => {
      // Without REDIS_URL set, should default to localhost:6379
      expect(connectionOptions.host).toBe("localhost");
      expect(connectionOptions.port).toBe(6379);
    });

    it("should have maxRetriesPerRequest set to null", () => {
      expect(connectionOptions.maxRetriesPerRequest).toBeNull();
    });
  });
});
