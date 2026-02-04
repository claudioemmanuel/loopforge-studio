import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { aiProviders, type AiProvider } from "@/lib/db/schema";
import { apiLogger } from "@/lib/logger";
import { handleError, Errors } from "@/lib/errors";
import { getUserService } from "@/lib/contexts/iam/api";

export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();
    const { provider } = body;

    if (!provider || !aiProviders.includes(provider)) {
      return handleError(Errors.invalidRequest("Invalid provider"));
    }

    const userService = getUserService();
    await userService.updateUserFields(user.id, {
      preferredProvider: provider as AiProvider,
    });

    return NextResponse.json({ success: true, provider });
  } catch (error) {
    apiLogger.error({ error }, "Failed to update provider");
    return handleError(error);
  }
});

export const GET = withAuth(async (_request, { user }) => {
  try {
    return NextResponse.json({
      provider: user.preferredProvider || "anthropic",
    });
  } catch (error) {
    apiLogger.error({ error }, "Failed to get provider");
    return handleError(error);
  }
});
