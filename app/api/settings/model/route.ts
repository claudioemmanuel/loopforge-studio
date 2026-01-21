import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";

// Valid models per provider
const VALID_MODELS = {
  anthropic: [
    "claude-sonnet-4-20250514",
    "claude-opus-4-20250514",
    "claude-haiku-3-20240307",
  ],
  openai: [
    "gpt-4o",
    "gpt-4-turbo",
    "gpt-4o-mini",
  ],
  gemini: [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
  ],
} as const;

type Provider = keyof typeof VALID_MODELS;

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { provider, model } = body as { provider: Provider; model: string };

    // Validate provider
    if (!provider || !VALID_MODELS[provider]) {
      return NextResponse.json(
        { error: "Invalid provider. Must be one of: anthropic, openai, gemini" },
        { status: 400 }
      );
    }

    // Validate model for the provider
    if (!model || !VALID_MODELS[provider].includes(model as never)) {
      return NextResponse.json(
        { error: `Invalid model for ${provider}. Valid models: ${VALID_MODELS[provider].join(", ")}` },
        { status: 400 }
      );
    }

    // Update the appropriate column based on provider
    const updateData: Record<string, string> = {};
    if (provider === "anthropic") {
      updateData.preferredAnthropicModel = model;
    } else if (provider === "openai") {
      updateData.preferredOpenaiModel = model;
    } else if (provider === "gemini") {
      updateData.preferredGeminiModel = model;
    }

    await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, session.user.id));

    return NextResponse.json({ success: true, provider, model });
  } catch (error) {
    console.error("Failed to update model preference:", error);
    return NextResponse.json(
      { error: "Failed to update model preference" },
      { status: 500 }
    );
  }
}
