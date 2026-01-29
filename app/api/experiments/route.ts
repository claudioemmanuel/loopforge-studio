import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { experiments, experimentVariants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { analyzeExperiment } from "@/lib/testing/statistics";

// GET /api/experiments - List all experiments
export const GET = withAuth(async () => {
  const allExperiments = await db.query.experiments.findMany({
    with: {
      variants: true,
    },
    orderBy: (experiments, { desc }) => [desc(experiments.createdAt)],
  });

  return NextResponse.json({ experiments: allExperiments });
});

// POST /api/experiments - Create new experiment
export const POST = withAuth(async (request) => {
  const body = await request.json();
  const { name, description, trafficAllocation, variants } = body;

  if (!name || !variants || variants.length < 2) {
    return NextResponse.json(
      { error: "Name and at least 2 variants required" },
      { status: 400 },
    );
  }

  // Validate weights sum to 100
  const totalWeight = variants.reduce(
    (sum: number, v: { weight: number }) => sum + v.weight,
    0,
  );
  if (totalWeight !== 100) {
    return NextResponse.json(
      { error: "Variant weights must sum to 100" },
      { status: 400 },
    );
  }

  // Create experiment
  const [experiment] = await db
    .insert(experiments)
    .values({
      name,
      description,
      trafficAllocation: trafficAllocation || 10,
      status: "draft",
    })
    .returning();

  // Create variants
  await db.insert(experimentVariants).values(
    variants.map((v: { name: string; weight: number; config: unknown }) => ({
      experimentId: experiment.id,
      name: v.name,
      weight: v.weight,
      config: v.config,
    })),
  );

  const created = await db.query.experiments.findFirst({
    where: eq(experiments.id, experiment.id),
    with: {
      variants: true,
    },
  });

  return NextResponse.json({ experiment: created });
});
