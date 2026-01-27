import { NextResponse } from "next/server";
import { canCreateTask, canExecuteTask, canAddRepo } from "./usage";

// =============================================================================
// Billing Middleware for API Routes
// =============================================================================

export type LimitType = "task" | "execution" | "repo";

interface LimitCheckOptions {
  userId: string;
  type: LimitType;
}

/**
 * Check billing limits before allowing an operation
 * Returns null if allowed, or a NextResponse error if not
 */
export async function checkBillingLimits(
  options: LimitCheckOptions,
): Promise<NextResponse | null> {
  const { userId, type } = options;

  let result;

  switch (type) {
    case "task":
      result = await canCreateTask(userId);
      break;
    case "execution":
      result = await canExecuteTask(userId);
      break;
    case "repo":
      result = await canAddRepo(userId);
      break;
  }

  if (!result.allowed) {
    return NextResponse.json(
      {
        error: "Limit exceeded",
        message: result.reason,
        currentUsage: result.currentUsage,
        limit: result.limit,
        code: "BILLING_LIMIT_EXCEEDED",
      },
      { status: 402 }, // Payment Required
    );
  }

  return null;
}

/**
 * Higher-order function to wrap API routes with billing checks
 */
export function withBillingCheck(
  type: LimitType,
  handler: (
    request: Request,
    context: { params: Record<string, string>; userId: string },
  ) => Promise<NextResponse>,
) {
  return async (
    request: Request,
    context: { params: Record<string, string>; userId: string },
  ): Promise<NextResponse> => {
    const limitError = await checkBillingLimits({
      userId: context.userId,
      type,
    });

    if (limitError) {
      return limitError;
    }

    return handler(request, context);
  };
}
