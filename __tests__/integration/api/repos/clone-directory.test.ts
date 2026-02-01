import { describe, it, expect, beforeEach, vi } from "vitest";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { expandPath } from "@/lib/utils/path-utils";

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: "test-user-id" },
    })
  ),
}));

describe("Clone Directory API", () => {
  let testUserId: string;

  beforeEach(async () => {
    // Create a test user
    const [user] = await db
      .insert(users)
      .values({
        githubId: `test-gh-${Date.now()}`,
        username: "testuser",
        email: "test@example.com",
      })
      .returning();
    testUserId = user.id;
  });

  describe("GET /api/settings/clone-directory", () => {
    it("should return null when no directory configured", async () => {
      const user = await db.query.users.findFirst({
        where: eq(users.id, testUserId),
      });

      expect(user?.defaultCloneDirectory).toBeNull();
    });

    it("should return configured directory", async () => {
      const testPath = "~/Documents/GitHub";

      await db
        .update(users)
        .set({ defaultCloneDirectory: testPath })
        .where(eq(users.id, testUserId));

      const user = await db.query.users.findFirst({
        where: eq(users.id, testUserId),
      });

      expect(user?.defaultCloneDirectory).toBe(testPath);
    });
  });

  describe("POST /api/settings/clone-directory", () => {
    it("should save clone directory configuration", async () => {
      const testPath = "~/Documents/GitHub";

      await db
        .update(users)
        .set({ defaultCloneDirectory: testPath })
        .where(eq(users.id, testUserId));

      const user = await db.query.users.findFirst({
        where: eq(users.id, testUserId),
      });

      expect(user?.defaultCloneDirectory).toBe(testPath);
      expect(expandPath(testPath)).toContain("Documents");
    });

    it("should update existing configuration", async () => {
      // Set initial path
      await db
        .update(users)
        .set({ defaultCloneDirectory: "~/Documents/GitHub" })
        .where(eq(users.id, testUserId));

      // Update to new path
      const newPath = "~/Projects";
      await db
        .update(users)
        .set({ defaultCloneDirectory: newPath })
        .where(eq(users.id, testUserId));

      const user = await db.query.users.findFirst({
        where: eq(users.id, testUserId),
      });

      expect(user?.defaultCloneDirectory).toBe(newPath);
    });
  });

  describe("Path expansion", () => {
    it("should expand ~ in stored paths", () => {
      const testPath = "~/Documents/GitHub";
      const expanded = expandPath(testPath);

      expect(expanded).not.toContain("~");
      expect(expanded).toContain("Documents");
    });

    it("should handle absolute paths", () => {
      const testPath = "/absolute/path/to/repos";
      const expanded = expandPath(testPath);

      expect(expanded).toBe(testPath);
    });
  });
});
