import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { apiLogger } from "@/lib/logger";
import { getUserService } from "@/lib/contexts/iam/api";

// Valid models per provider
const VALID_MODELS = {
  anthropic: [
    "claude-sonnet-4-20250514",
    "claude-opus-4-20250514",
    "claude-haiku-3-20240307",
  ],
  openai: ["gpt-4o", "gpt-4-turbo", "gpt-4o-mini"],
  gemini: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"],
} as const;

type Provider = keyof typeof VALID_MODELS;

export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();
    const { provider, model } = body as { provider: Provider; model: string };

    if (!provider || !VALID_MODELS[provider]) {
      return NextResponse.json(
        {
          error: "Invalid provider. Must be one of: anthropic, openai, gemini",
        },
        { status: 400 },
      );
    }

    if (!model || !VALID_MODELS[provider].includes(model as never)) {
      return NextResponse.json(
        {
          error: `Invalid model for ${provider}. Valid models: ${VALID_MODELS[provider].join(", ")}`,
        },
        { status: 400 },
      );
    }

    const modelField =
      provider === "anthropic"
        ? "preferredAnthropicModel"
        : provider === "openai"
          ? "preferredOpenaiModel"
          : "preferredGeminiModel";

    const userService = getUserService();
    await userService.updateUserFields(user.id, { [modelField]: model });

    return NextResponse.json({ success: true, provider, model });
  } catch (error) {
    apiLogger.error({ error }, "Failed to update model preference");
    return NextResponse.json(
      { error: "Failed to update model preference" },
      { status: 500 },
    );
  }
});
