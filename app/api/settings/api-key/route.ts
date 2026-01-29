import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { encryptApiKey } from "@/lib/crypto/keys";
import type { AiProvider } from "@/lib/db/schema";

// POST: Set or update an API key for a provider
export const POST = withAuth(async (request, { user }) => {
  const body = await request.json();
  const { provider, apiKey } = body as { provider: AiProvider; apiKey: string };

  if (!provider || !apiKey) {
    return NextResponse.json(
      { error: "Provider and API key are required" },
      { status: 400 },
    );
  }

  if (!["anthropic", "openai", "gemini"].includes(provider)) {
    return NextResponse.json(
      { error: "Invalid provider. Supported: anthropic, openai, gemini" },
      { status: 400 },
    );
  }

  // Validate API key format
  if (provider === "anthropic" && !apiKey.startsWith("sk-ant-")) {
    return NextResponse.json(
      {
        error:
          "Invalid Anthropic API key format. Key should start with sk-ant-",
      },
      { status: 400 },
    );
  }

  if (provider === "openai" && !apiKey.startsWith("sk-")) {
    return NextResponse.json(
      { error: "Invalid OpenAI API key format. Key should start with sk-" },
      { status: 400 },
    );
  }

  if (provider === "gemini" && !apiKey.startsWith("AIza")) {
    return NextResponse.json(
      {
        error:
          "Invalid Google Gemini API key format. Key should start with AIza",
      },
      { status: 400 },
    );
  }

  // Encrypt the API key
  const { encrypted, iv } = encryptApiKey(apiKey);

  // Update the appropriate columns based on provider
  const updateData =
    provider === "anthropic"
      ? { encryptedApiKey: encrypted, apiKeyIv: iv }
      : provider === "openai"
        ? { openaiEncryptedApiKey: encrypted, openaiApiKeyIv: iv }
        : { geminiEncryptedApiKey: encrypted, geminiApiKeyIv: iv };

  await db
    .update(users)
    .set({
      ...updateData,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  // Return masked key
  const maskedKey =
    provider === "anthropic"
      ? `sk-ant-•••••••••••••${apiKey.slice(-4)}`
      : provider === "openai"
        ? `sk-•••••••••••••${apiKey.slice(-4)}`
        : `AIza•••••••••••••${apiKey.slice(-4)}`;

  return NextResponse.json({
    success: true,
    provider,
    maskedKey,
  });
});

// DELETE: Remove an API key for a provider
export const DELETE = withAuth(async (request, { user }) => {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider") as AiProvider | null;

  if (!provider) {
    return NextResponse.json(
      { error: "Provider is required" },
      { status: 400 },
    );
  }

  if (!["anthropic", "openai", "gemini"].includes(provider)) {
    return NextResponse.json(
      { error: "Invalid provider. Supported: anthropic, openai, gemini" },
      { status: 400 },
    );
  }

  // Clear the appropriate columns based on provider
  const updateData =
    provider === "anthropic"
      ? { encryptedApiKey: null, apiKeyIv: null }
      : provider === "openai"
        ? { openaiEncryptedApiKey: null, openaiApiKeyIv: null }
        : { geminiEncryptedApiKey: null, geminiApiKeyIv: null };

  await db
    .update(users)
    .set({
      ...updateData,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  return NextResponse.json({
    success: true,
    provider,
  });
});
