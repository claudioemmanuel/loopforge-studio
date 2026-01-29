import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { experiments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// GET /api/experiments/[id] - Get experiment details
export const GET = withAuth(async (request) => {
  const url = new URL(request.url);
  const experimentId = url.pathname.split("/").pop();

  if (!experimentId) {
    return NextResponse.json(
      { error: "Experiment ID is required" },
      { status: 400 },
    );
  }

  const experiment = await db.query.experiments.findFirst({
    where: eq(experiments.id, experimentId),
    with: {
      variants: true,
    },
  });

  if (!experiment) {
    return NextResponse.json(
      { error: "Experiment not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ experiment });
});

// PATCH /api/experiments/[id] - Update experiment status
export const PATCH = withAuth(async (request) => {
  const url = new URL(request.url);
  const experimentId = url.pathname.split("/").pop();

  if (!experimentId) {
    return NextResponse.json(
      { error: "Experiment ID is required" },
      { status: 400 },
    );
  }

  const body = await request.json();
  const { status, startDate, endDate } = body;

  const validStatuses = ["draft", "active", "paused", "completed"];
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (status) {
    updates.status = status;
    if (status === "active" && !startDate) {
      updates.startDate = new Date();
    }
  }

  if (startDate) updates.startDate = new Date(startDate);
  if (endDate) updates.endDate = new Date(endDate);

  const [updated] = await db
    .update(experiments)
    .set(updates)
    .where(eq(experiments.id, experimentId))
    .returning();

  return NextResponse.json({ experiment: updated });
});
