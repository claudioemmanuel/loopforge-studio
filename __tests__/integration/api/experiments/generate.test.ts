/**
 * Integration tests for experiment analysis pipeline.
 *
 * Legacy `/api/experiments/generate` route was removed; this suite validates
 * current experiment persistence + analytics behavior.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { analyzeExperiment } from "@/lib/contexts/analytics/infrastructure/experiment-statistics";

describe("Experiment Analysis Integration", () => {
  let userId: string;
  let repoId: string;
  let taskId: string;

  beforeEach(async () => {
    const unique = `${Date.now()}-${Math.random()}`;

    userId = randomUUID();
    await db.insert(schema.users).values({
      id: userId,
      githubId: `gh-${unique}`,
      username: `user-${unique}`,
      email: `user-${unique}@example.com`,
    });

    repoId = randomUUID();
    await db.insert(schema.repos).values({
      id: repoId,
      userId,
      githubRepoId: `repo-${unique}`,
      name: "exp-repo",
      fullName: `owner/exp-repo-${unique}`,
      cloneUrl: "https://github.com/owner/exp-repo.git",
      defaultBranch: "main",
    });

    taskId = randomUUID();
    await db.insert(schema.tasks).values({
      id: taskId,
      repoId,
      title: "Experiment Task",
      status: "todo",
    });
  });

  it("returns null for unknown experiment", async () => {
    const result = await analyzeExperiment("unknown-experiment", "latency_ms");
    expect(result).toBeNull();
  });

  it("computes variant statistics and significance for two-variant experiments", async () => {
    const [experiment] = await db
      .insert(schema.experiments)
      .values({
        id: randomUUID(),
        name: `exp-${Date.now()}`,
        description: "Experiment for integration test",
        status: "active",
        trafficAllocation: 50,
      })
      .returning();

    const [control, treatment] = await db
      .insert(schema.experimentVariants)
      .values([
        {
          id: randomUUID(),
          experimentId: experiment.id,
          name: "control",
          weight: 50,
          config: { type: "prompt", promptOverrides: {} },
        },
        {
          id: randomUUID(),
          experimentId: experiment.id,
          name: "treatment",
          weight: 50,
          config: { type: "prompt", promptOverrides: {} },
        },
      ])
      .returning();

    const [t1, t2, t3, t4] = await db
      .insert(schema.tasks)
      .values([
        { id: randomUUID(), repoId, title: "exp-task-1", status: "todo" },
        { id: randomUUID(), repoId, title: "exp-task-2", status: "todo" },
        { id: randomUUID(), repoId, title: "exp-task-3", status: "todo" },
        { id: randomUUID(), repoId, title: "exp-task-4", status: "todo" },
      ])
      .returning();

    const [a1, a2, a3, a4] = await db
      .insert(schema.variantAssignments)
      .values([
        {
          id: randomUUID(),
          experimentId: experiment.id,
          variantId: control.id,
          userId,
          taskId: t1.id,
        },
        {
          id: randomUUID(),
          experimentId: experiment.id,
          variantId: control.id,
          userId,
          taskId: t2.id,
        },
        {
          id: randomUUID(),
          experimentId: experiment.id,
          variantId: treatment.id,
          userId,
          taskId: t3.id,
        },
        {
          id: randomUUID(),
          experimentId: experiment.id,
          variantId: treatment.id,
          userId,
          taskId: t4.id,
        },
      ])
      .returning();

    await db.insert(schema.experimentMetrics).values([
      {
        id: randomUUID(),
        variantAssignmentId: a1.id,
        metricName: "latency_ms",
        metricValue: 120,
      },
      {
        id: randomUUID(),
        variantAssignmentId: a2.id,
        metricName: "latency_ms",
        metricValue: 130,
      },
      {
        id: randomUUID(),
        variantAssignmentId: a3.id,
        metricName: "latency_ms",
        metricValue: 90,
      },
      {
        id: randomUUID(),
        variantAssignmentId: a4.id,
        metricName: "latency_ms",
        metricValue: 95,
      },
    ]);

    const analysis = await analyzeExperiment(experiment.name, "latency_ms");
    expect(analysis).toBeTruthy();
    expect(analysis?.variants).toHaveLength(2);
    expect(analysis?.comparison).toBeTruthy();
    expect(analysis?.comparison?.control.sampleSize).toBe(2);
    expect(analysis?.comparison?.treatment.sampleSize).toBe(2);
    expect(analysis?.comparison?.recommendation).toMatch(
      /continue|rollout|stop/,
    );
  });
});
