import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { aiProviders, type AiProvider } from "@/lib/db/schema";
import { apiLogger } from "@/lib/logger";
import { handleError, Errors } from "@/lib/errors";

export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();
    const { provider } = body;

    // Validate provider
    if (!provider || !aiProviders.includes(provider)) {
      return handleError(Errors.invalidRequest("Invalid provider"));
    }

    // Update user's preferred provider
    await db
      .update(users)
      .set({
        preferredProvider: provider as AiProvider,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

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
