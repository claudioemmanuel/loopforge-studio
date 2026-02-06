import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { getUserService, type AiProvider } from "@/lib/contexts/iam/api";

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

  // Key format validation (boundary check – stays in route)
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

  // Encryption is handled inside configureProvider
  const userService = getUserService();
  await userService.configureProvider({ userId: user.id, provider, apiKey });

  // Masked key computed from raw input before it leaves scope
  const maskedKey =
    provider === "anthropic"
      ? `sk-ant-•••••••••••••${apiKey.slice(-4)}`
      : provider === "openai"
        ? `sk-•••••••••••••${apiKey.slice(-4)}`
        : `AIza•••••••••••••${apiKey.slice(-4)}`;

  return NextResponse.json({ success: true, provider, maskedKey });
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

  const userService = getUserService();
  await userService.removeProvider(user.id, provider);

  return NextResponse.json({ success: true, provider });
});
