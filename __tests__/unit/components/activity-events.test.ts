import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { getTestDb, getTestPool } from "./setup/test-db";

const TEST_PREFIX = `activity-events-${Date.now()}`;

describe("Activity Events Schema", () => {
  const db = getTestDb();

  // Ensure the activity tables exist
  beforeEach(async () => {
    const pool = getTestPool();
    await pool.query(`
      -- Create activity_event_category enum if not exists
      DO $$ BEGIN
        CREATE TYPE activity_event_category AS ENUM ('ai_action', 'git', 'system', 'test', 'review');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      -- Create activity_events table if not exists
      CREATE TABLE IF NOT EXISTS activity_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
        repo_id UUID REFERENCES repos(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        execution_id UUID REFERENCES executions(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        event_category activity_event_category NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT now() NOT NULL
      );

      -- Create activity_summaries table if not exists
      CREATE TABLE IF NOT EXISTS activity_summaries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        repo_id UUID REFERENCES repos(id) ON DELETE CASCADE,
        date TIMESTAMP NOT NULL,
        tasks_completed INTEGER DEFAULT 0,
        tasks_failed INTEGER DEFAULT 0,
        commits INTEGER DEFAULT 0,
        files_changed INTEGER DEFAULT 0,
        tokens_used INTEGER DEFAULT 0,
        summary_text TEXT,
        created_at TIMESTAMP DEFAULT now() NOT NULL
      );
    `);
  });

  describe("Activity Events", () => {
    it("should create an activity event", async () => {
      // Setup user
      const [user] = await db
        .insert(schema.users)
        .values({
          githubId: `${TEST_PREFIX}-user-1`,
          username: "testuser",
        })
        .returning();

      // Setup repo
      const [repo] = await db
        .insert(schema.repos)
        .values({
          userId: user.id,
          githubRepoId: "repo-12345",
          name: "test-repo",
          fullName: "testuser/test-repo",
          cloneUrl: "https://github.com/testuser/test-repo.git",
        })
        .returning();

      // Setup task
      const [task] = await db
        .insert(schema.tasks)
        .values({
          repoId: repo.id,
          title: "Test task",
        })
        .returning();

      // Create activity event
      const [event] = await db
        .insert(schema.activityEvents)
        .values({
          taskId: task.id,
          repoId: repo.id,
          userId: user.id,
          eventType: "file_write",
          eventCategory: "ai_action",
          title: "Created file: src/index.ts",
          content: "Created new TypeScript file with component scaffold",
          metadata: {
            filePath: "src/index.ts",
            filesCreated: 1,
          },
        })
        .returning();

      expect(event).toBeDefined();
      expect(event.id).toBeDefined();
      expect(event.eventType).toBe("file_write");
      expect(event.eventCategory).toBe("ai_action");
      expect(event.title).toBe("Created file: src/index.ts");
      expect(event.metadata).toHaveProperty("filePath", "src/index.ts");
    });

    it("should query activity events by category", async () => {
      const [user] = await db
        .insert(schema.users)
        .values({
          githubId: `${TEST_PREFIX}-user-category`,
          username: "testuser",
        })
        .returning();

      // Create events with different categories
      await db.insert(schema.activityEvents).values([
        {
          userId: user.id,
          eventType: "thinking",
          eventCategory: "ai_action",
          title: "AI thinking event",
        },
        {
          userId: user.id,
          eventType: "commit",
          eventCategory: "git",
          title: "Git commit event",
        },
        {
          userId: user.id,
          eventType: "test_run",
          eventCategory: "system",
          title: "Test run event",
        },
      ]);

      // Query only ai_action events
      const aiEvents = await db.query.activityEvents.findMany({
        where: eq(schema.activityEvents.eventCategory, "ai_action"),
      });

      expect(aiEvents.length).toBeGreaterThanOrEqual(1);
      expect(aiEvents.every((e) => e.eventCategory === "ai_action")).toBe(true);
    });

    it("should support all event categories", async () => {
      const [user] = await db
        .insert(schema.users)
        .values({
          githubId: `${TEST_PREFIX}-user-all-cats`,
          username: "testuser",
        })
        .returning();

      const categories: schema.ActivityEventCategory[] = [
        "ai_action",
        "git",
        "system",
      ];

      for (const category of categories) {
        const [event] = await db
          .insert(schema.activityEvents)
          .values({
            userId: user.id,
            eventType: "test_event",
            eventCategory: category,
            title: `Event with category: ${category}`,
          })
          .returning();

        expect(event.eventCategory).toBe(category);
      }
    });

    it("should cascade delete when user is deleted", async () => {
      const [user] = await db
        .insert(schema.users)
        .values({
          githubId: `${TEST_PREFIX}-user-cascade`,
          username: "testuser",
        })
        .returning();

      await db.insert(schema.activityEvents).values({
        userId: user.id,
        eventType: "test",
        eventCategory: "system",
        title: "Test event",
      });

      // Delete user
      await db.delete(schema.users).where(eq(schema.users.id, user.id));

      // Verify events are deleted
      const events = await db.query.activityEvents.findMany({
        where: eq(schema.activityEvents.userId, user.id),
      });

      expect(events).toHaveLength(0);
    });
  });

  describe("Activity Summaries", () => {
    it("should create an activity summary", async () => {
      const [user] = await db
        .insert(schema.users)
        .values({
          githubId: `${TEST_PREFIX}-user-summary`,
          username: "testuser",
        })
        .returning();

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [summary] = await db
        .insert(schema.activitySummaries)
        .values({
          userId: user.id,
          date: today,
          tasksCompleted: 5,
          tasksFailed: 1,
          commits: 12,
          filesChanged: 24,
          tokensUsed: 50000,
          summaryText: "Productive day with 5 tasks completed",
        })
        .returning();

      expect(summary).toBeDefined();
      expect(summary.tasksCompleted).toBe(5);
      expect(summary.tasksFailed).toBe(1);
      expect(summary.commits).toBe(12);
      expect(summary.filesChanged).toBe(24);
    });

    it("should default numeric fields to 0", async () => {
      const [user] = await db
        .insert(schema.users)
        .values({
          githubId: `${TEST_PREFIX}-user-defaults`,
          username: "testuser",
        })
        .returning();

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [summary] = await db
        .insert(schema.activitySummaries)
        .values({
          userId: user.id,
          date: today,
        })
        .returning();

      expect(summary.tasksCompleted).toBe(0);
      expect(summary.tasksFailed).toBe(0);
      expect(summary.commits).toBe(0);
      expect(summary.filesChanged).toBe(0);
      expect(summary.tokensUsed).toBe(0);
    });
  });
});
