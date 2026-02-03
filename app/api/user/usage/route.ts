import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUsageSummary } from "@/lib/billing/domain";
import { handleError, Errors } from "@/lib/errors";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return handleError(Errors.unauthorized());
  }

  try {
    const usage = await getUsageSummary(session.user.id);

    return NextResponse.json({
      currentPeriod: {
        start: usage.currentPeriod.start.toISOString(),
        end: usage.currentPeriod.end.toISOString(),
      },
      tokens: {
        used: usage.tokens.used,
        limit: usage.tokens.limit,
        percentUsed: Math.round(usage.tokens.percentUsed),
      },
      tasks: {
        created: usage.tasks.created,
        limit: usage.tasks.limit,
        percentUsed: Math.round(usage.tasks.percentUsed),
      },
      repos: {
        count: usage.repos.count,
        limit: usage.repos.limit,
        percentUsed: Math.round(usage.repos.percentUsed),
      },
      estimatedCost: {
        cents: usage.estimatedCost,
        formatted: `$${(usage.estimatedCost / 100).toFixed(2)}`,
      },
      billingMode: usage.billingMode,
      plan: usage.plan,
    });
  } catch (error) {
    return handleError(error);
  }
}
