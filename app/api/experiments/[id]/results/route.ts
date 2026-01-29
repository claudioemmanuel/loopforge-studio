import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { experiments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { analyzeExperiment } from "@/lib/testing/statistics";

// GET /api/experiments/[id]/results - Get statistical analysis
export const GET = withAuth(async (request) => {
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/");
  const experimentId = pathParts[pathParts.indexOf("experiments") + 1];

  if (!experimentId) {
    return NextResponse.json(
      { error: "Experiment ID is required" },
      { status: 400 },
    );
  }

  const searchParams = new URL(request.url).searchParams;
  const metricName = searchParams.get("metric") || "task_success";

  const experiment = await db.query.experiments.findFirst({
    where: eq(experiments.id, experimentId),
  });

  if (!experiment) {
    return NextResponse.json(
      { error: "Experiment not found" },
      { status: 404 },
    );
  }

  const analysis = await analyzeExperiment(experiment.name, metricName);

  if (!analysis) {
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }

  return NextResponse.json({ analysis });
});
