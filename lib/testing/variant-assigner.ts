/**
 * Variant Assigner for A/B Testing
 *
 * Provides deterministic variant assignment using SHA-256 hashing.
 * Same task always gets same variant, enabling reliable experimentation.
 */

import { createHash } from "crypto";
import { db } from "@/lib/db";
import {
  experiments,
  experimentVariants,
  variantAssignments,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export interface VariantAssignmentResult {
  variantId: string;
  variantName: string;
  config: Record<string, unknown>;
  assignmentId: string;
}

/**
 * Assign a variant to a task for an experiment
 * Uses deterministic hashing to ensure same task always gets same variant
 *
 * @param experimentName - Name of the experiment
 * @param taskId - ID of the task
 * @param userId - ID of the user
 * @returns Variant assignment or null if experiment not active
 */
export async function assignVariant(
  experimentName: string,
  taskId: string,
  userId: string,
): Promise<VariantAssignmentResult | null> {
  // Get experiment
  const experiment = await db.query.experiments.findFirst({
    where: eq(experiments.name, experimentName),
    with: {
      variants: true,
    },
  });

  if (!experiment) {
    return null;
  }

  // Check if experiment is active
  if (experiment.status !== "active") {
    return null;
  }

  // Check if within date range
  const now = new Date();
  if (experiment.startDate && now < experiment.startDate) {
    return null;
  }
  if (experiment.endDate && now > experiment.endDate) {
    return null;
  }

  // Check traffic allocation
  const shouldInclude = shouldIncludeInExperiment(
    taskId,
    experiment.trafficAllocation,
  );
  if (!shouldInclude) {
    return null;
  }

  // Check if already assigned
  const existingAssignment = await db.query.variantAssignments.findFirst({
    where: and(
      eq(variantAssignments.experimentId, experiment.id),
      eq(variantAssignments.taskId, taskId),
    ),
    with: {
      variant: true,
    },
  });

  if (existingAssignment) {
    return {
      variantId: existingAssignment.variantId,
      variantName: existingAssignment.variant.name,
      config: existingAssignment.variant.config as unknown as Record<
        string,
        unknown
      >,
      assignmentId: existingAssignment.id,
    };
  }

  // Assign variant using deterministic hashing
  const variant = selectVariant(taskId, experiment.variants);

  // Create assignment
  const [assignment] = await db
    .insert(variantAssignments)
    .values({
      experimentId: experiment.id,
      variantId: variant.id,
      userId,
      taskId,
    })
    .returning();

  return {
    variantId: variant.id,
    variantName: variant.name,
    config: variant.config as unknown as Record<string, unknown>,
    assignmentId: assignment.id,
  };
}

/**
 * Determine if task should be included in experiment based on traffic allocation
 * Uses deterministic hashing to ensure consistent inclusion
 */
function shouldIncludeInExperiment(
  taskId: string,
  trafficAllocation: number,
): boolean {
  const hash = createHash("sha256").update(`traffic_${taskId}`).digest("hex");

  // Convert first 8 hex chars to number between 0 and 100
  const hashValue = parseInt(hash.substring(0, 8), 16) % 100;

  return hashValue < trafficAllocation;
}

/**
 * Select variant using deterministic hashing based on weights
 * Ensures same task always gets same variant
 */
function selectVariant(
  taskId: string,
  variants: Array<{
    id: string;
    name: string;
    weight: number;
    config: unknown;
  }>,
): { id: string; name: string; weight: number; config: unknown } {
  if (variants.length === 0) {
    throw new Error("No variants available for experiment");
  }

  // Calculate total weight
  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);

  // Generate deterministic hash value between 0 and totalWeight
  const hash = createHash("sha256").update(`variant_${taskId}`).digest("hex");

  const hashValue = parseInt(hash.substring(0, 16), 16);
  const selection = hashValue % totalWeight;

  // Select variant based on cumulative weights
  let cumulative = 0;
  for (const variant of variants) {
    cumulative += variant.weight;
    if (selection < cumulative) {
      return variant;
    }
  }

  // Fallback to first variant (should never reach here)
  return variants[0];
}

/**
 * Get assignment for a task in an experiment
 * Returns existing assignment or null if not assigned
 */
export async function getAssignment(
  experimentName: string,
  taskId: string,
): Promise<VariantAssignmentResult | null> {
  const experiment = await db.query.experiments.findFirst({
    where: eq(experiments.name, experimentName),
  });

  if (!experiment) {
    return null;
  }

  const assignment = await db.query.variantAssignments.findFirst({
    where: and(
      eq(variantAssignments.experimentId, experiment.id),
      eq(variantAssignments.taskId, taskId),
    ),
    with: {
      variant: true,
    },
  });

  if (!assignment) {
    return null;
  }

  return {
    variantId: assignment.variantId,
    variantName: assignment.variant.name,
    config: assignment.variant.config as unknown as Record<string, unknown>,
    assignmentId: assignment.id,
  };
}
