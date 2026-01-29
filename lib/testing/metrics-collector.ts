/**
 * Metrics Collector for A/B Testing
 *
 * Records experiment metrics for statistical analysis.
 * Tracks success rates, iterations, tokens, execution time.
 */

import { db } from "@/lib/db";
import { experimentMetrics, variantAssignments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export interface MetricRecord {
  metricName: string;
  metricValue: number;
  metadata?: Record<string, unknown>;
}

/**
 * Record a single metric for a task assignment
 *
 * @param assignmentId - Variant assignment ID
 * @param metricName - Name of the metric (e.g., "task_success", "iterations_count")
 * @param metricValue - Numeric value (1 for success, count for iterations, etc.)
 * @param metadata - Optional additional context
 */
export async function recordMetric(
  assignmentId: string,
  metricName: string,
  metricValue: number,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await db.insert(experimentMetrics).values({
    variantAssignmentId: assignmentId,
    metricName,
    metricValue,
    metadata: metadata || {},
  });
}

/**
 * Record multiple metrics for a task assignment
 * More efficient than calling recordMetric multiple times
 *
 * @param assignmentId - Variant assignment ID
 * @param metrics - Array of metrics to record
 */
export async function recordMetrics(
  assignmentId: string,
  metrics: MetricRecord[],
): Promise<void> {
  if (metrics.length === 0) {
    return;
  }

  await db.insert(experimentMetrics).values(
    metrics.map((metric) => ({
      variantAssignmentId: assignmentId,
      metricName: metric.metricName,
      metricValue: metric.metricValue,
      metadata: metric.metadata || {},
    })),
  );
}

/**
 * Record task completion metrics
 * Convenience function for common metrics
 */
export async function recordTaskMetrics(
  assignmentId: string,
  data: {
    success: boolean;
    iterations: number;
    tokenCount: number;
    executionTimeMs: number;
    stuckReason?: string;
  },
): Promise<void> {
  const metrics: MetricRecord[] = [
    {
      metricName: "task_success",
      metricValue: data.success ? 1 : 0,
    },
    {
      metricName: "iterations_count",
      metricValue: data.iterations,
    },
    {
      metricName: "token_count",
      metricValue: data.tokenCount,
    },
    {
      metricName: "execution_time_ms",
      metricValue: data.executionTimeMs,
    },
  ];

  if (!data.success && data.stuckReason) {
    metrics.push({
      metricName: "stuck",
      metricValue: 1,
      metadata: { reason: data.stuckReason },
    });
  }

  await recordMetrics(assignmentId, metrics);
}

/**
 * Get all metrics for a variant assignment
 */
export async function getMetricsForAssignment(
  assignmentId: string,
): Promise<
  Array<{
    metricName: string;
    metricValue: number;
    metadata: Record<string, unknown> | null;
  }>
> {
  const metrics = await db.query.experimentMetrics.findMany({
    where: eq(experimentMetrics.variantAssignmentId, assignmentId),
  });

  return metrics.map((m) => ({
    metricName: m.metricName,
    metricValue: m.metricValue,
    metadata: (m.metadata as Record<string, unknown>) || null,
  }));
}
